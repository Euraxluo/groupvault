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

    while (last < head) {
      const height = last + 1
      const receipts = await this.rpc.chunkMessages(height)
      const messages = receipts
        .filter((receipt) => receipt.executorId === this.options.contractId)
        .flatMap((receipt) =>
          parseReceiptLogs(receipt.receiptId, receipt.logs, height),
        )
      insertedMessages += this.store.commitBlock(height, messages)
      last = height
      processedBlocks += 1
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
