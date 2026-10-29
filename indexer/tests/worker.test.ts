import { describe, expect, it } from "vitest"

import { MessageStore } from "../src/store.js"
import { IndexerWorker } from "../src/worker.js"
import type { RpcClient, ReceiptOutcome } from "../src/rpc.js"

class FakeRpc implements RpcClient {
  readonly calls = new Map<number, number>()

  constructor(
    public head: number,
    public receipts: Map<number, ReceiptOutcome[]> = new Map(),
    public failuresRemaining: Map<number, number> = new Map(),
  ) {}

  async finalBlockHeight(): Promise<number> {
    return this.head
  }

  async chunkMessages(height: number): Promise<ReceiptOutcome[]> {
    this.calls.set(height, (this.calls.get(height) ?? 0) + 1)
    const remaining = this.failuresRemaining.get(height) ?? 0
    if (remaining > 0) {
      this.failuresRemaining.set(height, remaining - 1)
      throw new Error("rpc boom")
    }
    return this.receipts.get(height) ?? []
  }
}

function log(groupId: number, text: string, sender = "a.testnet"): string {
  return JSON.stringify({
    standard: "groupvault",
    version: "0.1.0",
    event: "message",
    data: { group_id: groupId, sender, text, ts: "1" },
  })
}

describe("IndexerWorker", () => {
  it("initializes at the finalized head for startBlock 0, not genesis", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(500)
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 0,
      initialBackfillBlocks: 0,
    })
    await worker.initialize()
    expect(store.lastProcessedBlock).toBe(499)
  })

  it("supports a bounded initial backfill", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(500)
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: null,
      initialBackfillBlocks: 3,
    })
    await worker.initialize()
    expect(store.lastProcessedBlock).toBe(496)
  })

  it("filters non-GroupVault executors", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(
      2,
      new Map([
        [
          2,
          [
            { receiptId: "r1", executorId: "gv.testnet", logs: [log(1, "yes")] },
            { receiptId: "r2", executorId: "other.testnet", logs: [log(1, "no")] },
          ],
        ],
      ]),
    )
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 2,
      initialBackfillBlocks: 0,
    })
    const result = await worker.tick()
    expect(result.insertedMessages).toBe(1)
    expect(store.page(1, null, 10).items.map((item) => item.text)).toEqual([
      "yes",
    ])
  })

  it("resumes from the persisted cursor after a restart", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(
      2,
      new Map([[2, [{ receiptId: "r1", executorId: "gv.testnet", logs: [log(1, "a")] }]]]),
    )
    const first = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 2,
      initialBackfillBlocks: 0,
    })
    await first.tick()

    rpc.head = 4;
    rpc.receipts.set(3, [
      { receiptId: "r2", executorId: "gv.testnet", logs: [log(1, "b")] },
    ])
    const restarted = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 1,
      initialBackfillBlocks: 0,
    })
    await restarted.tick()

    expect(store.page(1, null, 10).items.map((item) => item.text)).toEqual([
      "a",
      "b",
    ])
    expect(store.lastProcessedBlock).toBe(4)
  })

  it("does not advance the cursor when RPC fails", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(3, new Map(), new Map([[2, Number.POSITIVE_INFINITY]]))
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 1,
      initialBackfillBlocks: 0,
      chunkFetchAttempts: 3,
      retryDelayMs: 0,
    })
    await worker.initialize()
    await expect(worker.tick()).rejects.toThrow("rpc boom")
    // Only the contiguous prefix before the failure is committed; the cursor
    // must not jump to the finalized head or skip the failed gap.
    expect(store.lastProcessedBlock).toBe(1)
    expect(rpc.calls.get(2)).toBe(3)
  })

  it("retries a transient chunk failure and commits its messages", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(
      2,
      new Map([
        [2, [{ receiptId: "r1", executorId: "gv.testnet", logs: [log(1, "kept")] }]],
      ]),
      new Map([[2, 1]]),
    )
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 2,
      initialBackfillBlocks: 0,
      chunkFetchAttempts: 3,
      retryDelayMs: 0,
    })

    await expect(worker.tick()).resolves.toMatchObject({
      insertedMessages: 1,
      lastProcessedBlock: 2,
    })
    expect(rpc.calls.get(2)).toBe(2)
    expect(store.page(1, null, 10).items.map((item) => item.text)).toEqual([
      "kept",
    ])
  })

  it("repairs messages when a previously processed block is replayed", async () => {
    const store = new MessageStore(":memory:")
    store.initializeCursor(0)
    store.commitBlock(1, [])
    // Simulate a cursor rewind after the old run marked the block processed
    // without inserting its message.
    store.setMeta("last_processed_block", "0")
    const rpc = new FakeRpc(
      1,
      new Map([
        [1, [{ receiptId: "r1", executorId: "gv.testnet", logs: [log(1, "recovered")] }]],
      ]),
    )
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 1,
      initialBackfillBlocks: 0,
      retryDelayMs: 0,
    })

    await worker.tick()
    expect(store.page(1, null, 10).items.map((item) => item.text)).toEqual([
      "recovered",
    ])
  })

  it("treats malformed logs as noise instead of crashing", async () => {
    const store = new MessageStore(":memory:")
    const rpc = new FakeRpc(
      1,
      new Map([
        [
          1,
          [
            {
              receiptId: "r1",
              executorId: "gv.testnet",
              logs: ["not-json", log(1, "ok")],
            },
          ],
        ],
      ]),
    )
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 1,
      initialBackfillBlocks: 0,
    })
    const result = await worker.tick()
    expect(result.insertedMessages).toBe(1)
  })
})
