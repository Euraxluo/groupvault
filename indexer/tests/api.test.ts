import { afterEach, describe, expect, it } from "vitest"
import type { Server } from "node:http"

import { createIndexerServer } from "../src/server.js"
import { MessageStore } from "../src/store.js"
import { IndexerWorker } from "../src/worker.js"
import type { RpcClient, ReceiptOutcome } from "../src/rpc.js"

class FakeRpc implements RpcClient {
  constructor(
    public head: number,
    private readonly receipts: Map<number, ReceiptOutcome[]> = new Map(),
  ) {}

  async finalBlockHeight(): Promise<number> {
    return this.head
  }

  async chunkMessages(height: number): Promise<ReceiptOutcome[]> {
    return this.receipts.get(height) ?? []
  }
}

const servers: Server[] = []
const stores: MessageStore[] = []

async function start(
  store: MessageStore,
  worker: IndexerWorker,
): Promise<{ server: Server; url: string }> {
  const server = createIndexerServer(store, worker)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no port")
  return { server, url: `http://127.0.0.1:${address.port}` }
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  )
  for (const store of stores.splice(0)) store.close()
})

function message(receiptId: string, groupId: number, text: string) {
  return {
    receiptId,
    executorId: "gv.testnet",
    logs: [
      JSON.stringify({
        standard: "groupvault",
        version: "0.1.0",
        event: "message",
        data: { group_id: groupId, sender: "a.testnet", text, ts: "1" },
      }),
    ],
  }
}

describe("indexer HTTP API", () => {
  it("reports health before and after the cursor is persisted", async () => {
    const store = new MessageStore(":memory:")
    stores.push(store)
    const rpc = new FakeRpc(10)
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: null,
      initialBackfillBlocks: 0,
    })
    const { url } = await start(store, worker)

    expect(await (await fetch(`${url}/health`)).json()).toMatchObject({
      ready: false,
      last_processed_block: null,
    })

    await worker.tick()
    const health = (await (await fetch(`${url}/health`)).json()) as Record<
      string,
      unknown
    >
    expect(health.ready).toBe(true)
    expect(health.last_finalized_block).toBe(10)
    expect(health.last_processed_block).toBe(10)
  })

  it("returns idempotent paginated messages", async () => {
    const store = new MessageStore(":memory:")
    stores.push(store)
    const rpc = new FakeRpc(
      12,
      new Map([
        [11, [message("r1", 1, "one"), message("r2", 1, "two")]],
        [12, [message("r3", 1, "three"), message("rX", 2, "other group")]],
      ]),
    )
    const worker = new IndexerWorker(store, rpc, {
      contractId: "gv.testnet",
      startBlock: 11,
      initialBackfillBlocks: 0,
    })
    const { url } = await start(store, worker)

    await worker.tick()
    // Replaying the same finalized range must not duplicate rows.
    rpc.head = 13
    await worker.tick()

    const first = (await (
      await fetch(`${url}/messages?group_id=1&limit=2`)
    ).json()) as { items: unknown[]; next_cursor: string | null }
    expect(first.items).toHaveLength(2)
    expect(first.next_cursor).toBeTruthy()

    const second = (await (
      await fetch(
        `${url}/messages?group_id=1&limit=2&cursor=${first.next_cursor}`,
      )
    ).json()) as { items: { text: string }[]; next_cursor: string | null }
    expect(second.items.map((item) => item.text)).toEqual(["three"])
    expect(second.next_cursor).toBeNull()

    const other = (await (
      await fetch(`${url}/messages?group_id=2`)
    ).json()) as { items: { text: string }[] }
    expect(other.items.map((item) => item.text)).toEqual(["other group"])
  })

  it("rejects bad queries without crashing", async () => {
    const store = new MessageStore(":memory:")
    stores.push(store)
    const worker = new IndexerWorker(store, new FakeRpc(1), {
      contractId: "gv.testnet",
      startBlock: null,
      initialBackfillBlocks: 0,
    })
    const { url } = await start(store, worker)

    expect((await fetch(`${url}/messages`)).status).toBe(400)
    expect((await fetch(`${url}/messages?group_id=-1`)).status).toBe(400)
    expect((await fetch(`${url}/messages?group_id=1&limit=51`)).status).toBe(400)
    expect(
      (await fetch(`${url}/messages?group_id=1&cursor=not-a-cursor`)).status,
    ).toBe(500)
    expect((await fetch(`${url}/nope`)).status).toBe(404)
  })
})
