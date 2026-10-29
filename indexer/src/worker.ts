import { parseReceiptLogs } from "./parser.js"
import type { RpcClient } from "./rpc.js"
import type { MessageStore } from "./store.js"

export interface WorkerOptions {
  contractId: string
  startBlock: number | null
  initialBackfillBlocks: number
  chunkFetchAttempts?: number
  retryDelayMs?: number
}

export interface TickResult {
  processedBlocks: number
  insertedMessages: number
  lastProcessedBlock: number
}

export class IndexerWorker {
  private lastFinalizedBlock: number | null = null
  private lastError: string | null = null
  private readonly chunkFetchAttempts: number
  private readonly retryDelayMs: number

  constructor(
    private readonly store: MessageStore,
    private readonly rpc: RpcClient,
    private readonly options: WorkerOptions,
  ) {
    this.chunkFetchAttempts = Math.max(1, options.chunkFetchAttempts ?? 3)
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? 500)
  }

  get health(): {
    ready: boolean
    lastFinalizedBlock: number | null
    lastProcessedBlock: number | null
    lastError: string | null
  } {
    return {
      ready: this.store.ready,
      lastFinalizedBlock: this.lastFinalizedBlock,
      lastProcessedBlock: this.store.lastProcessedBlock,
      lastError: this.lastError,
    }
  }

  /**
   * Persist the first cursor once. `startBlock: 0` means "current finalized
   * head", never genesis; an optional bounded backfill is applied.
   */
  async initialize(): Promise<void> {
    if (this.store.lastProcessedBlock !== null) return

    const head = await this.rpc.finalBlockHeight()
    this.lastFinalizedBlock = head
    const requested = this.options.startBlock
    let start: number
    if (requested !== null && requested > 0) {
      start = requested
    } else {
      start = Math.max(0, head - this.options.initialBackfillBlocks)
    }
    // The cursor is the last processed block, so start one block earlier.
    this.store.initializeCursor(Math.max(0, start - 1))
  }

  async tick(): Promise<TickResult> {
    await this.initialize()
    const head = await this.rpc.finalBlockHeight()
    this.lastFinalizedBlock = head

    let last = this.store.lastProcessedBlock ?? 0
    let processedBlocks = 0
    let insertedMessages = 0

    // Testnet produces ~1 block/s. A small window keeps pace while limiting
    // public-RPC bursts; each block is retried before the window is committed.
    const windowSize = 2
    while (last < head) {
      const heights: number[] = []
      for (
        let height = last + 1;
        height <= head && heights.length < windowSize;
        height += 1
      ) {
        heights.push(height)
      }
      if (heights.length === 0) break

      const fetched = await Promise.allSettled(
        heights.map(async (height) => ({
          height,
          receipts: await this.fetchChunkWithRetry(height),
        })),
      )

      // Commit only the contiguous prefix that succeeded. A throttled block
      // (public RPC 429) must not discard the whole window, and the cursor must
      // never skip a gap.
      let failed = false
      for (const result of fetched) {
        if (result.status === "rejected") {
          this.recordError(result.reason)
          failed = true
          break
        }
        const { height, receipts } = result.value
        const messages = receipts
          .filter((receipt) => receipt.executorId === this.options.contractId)
          .flatMap((receipt) =>
            parseReceiptLogs(receipt.receiptId, receipt.logs, height),
          )
        insertedMessages += this.store.commitBlock(height, messages)
        last = height
        processedBlocks += 1
      }
      if (failed) {
        // Commit the safe prefix, then fail this window so the cursor waits at
        // the gap instead of looping and hammering the throttled block.
        throw new Error(this.lastError ?? "indexer window made no progress")
      }
    }

    this.lastError = null
    return {
      processedBlocks,
      insertedMessages,
      lastProcessedBlock: last,
    }
  }

  private async fetchChunkWithRetry(
    height: number,
  ): Promise<Awaited<ReturnType<RpcClient["chunkMessages"]>>> {
    let lastError: unknown
    for (let attempt = 0; attempt < this.chunkFetchAttempts; attempt += 1) {
      try {
        return await this.rpc.chunkMessages(height)
      } catch (error) {
        lastError = error
        this.recordError(error)
        if (attempt + 1 < this.chunkFetchAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * 2 ** attempt),
          )
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`chunk fetch failed for block ${height}`)
  }

  recordError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error)
  }

  async start(pollIntervalMs: number, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.tick()
      } catch (error) {
        this.recordError(error)
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, pollIntervalMs)
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      })
    }
  }
}
