import { parseReceiptLogs } from "./parser.js"
import type { RpcClient } from "./rpc.js"
import type { MessageStore } from "./store.js"

export interface WorkerOptions {
  contractId: string
  startBlock: number | null
  initialBackfillBlocks: number
}

export interface TickResult {
  processedBlocks: number
  insertedMessages: number
  lastProcessedBlock: number
}

export class IndexerWorker {
  private lastFinalizedBlock: number | null = null
  private lastError: string | null = null

  constructor(
    private readonly store: MessageStore,
    private readonly rpc: RpcClient,
    private readonly options: WorkerOptions,
  ) {}

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

    // Testnet produces ~1 block/s. Fetching blocks strictly sequentially is
    // slower than that once each block costs several RPC round-trips, so the
    // cursor falls further behind forever. Fetch a bounded window concurrently
    // and commit it in ascending order to keep the cursor monotonic.
    const windowSize = 8
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
          receipts: await this.rpc.chunkMessages(height),
        })),
      )

      // Commit only the contiguous prefix that succeeded. A throttled block
      // (public RPC 429) must not discard the whole window, and the cursor must
      // never skip a gap.
      let committed = 0
      for (const result of fetched) {
        if (result.status === "rejected") {
          this.recordError(result.reason)
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
        committed += 1
      }
      if (committed === 0) {
        // Nothing advanced; surface the failure instead of spinning silently.
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
