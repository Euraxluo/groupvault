import { describe, expect, it } from "vitest"

import { NearRpcClient } from "../src/rpc.js"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("NearRpcClient", () => {
  it("fails the block when a shard cannot be fetched", async () => {
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string }
      if (request.method === "block") {
        return jsonResponse({
          result: {
            chunks: [
              {
                chunk_hash: "chunk-1",
                tx_root: "not-empty",
              },
            ],
          },
        })
      }
      return jsonResponse({ error: { message: "rate limited" } }, 400)
    }) as typeof fetch
    const rpc = new NearRpcClient(
      "https://rpc.example",
      "gv.testnet",
      fetchImpl,
      0,
    )

    await expect(rpc.chunkMessages(10)).rejects.toThrow("HTTP 400")
  })

  it("retries a throttled shard instead of treating it as empty", async () => {
    let chunkCalls = 0
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string }
      if (request.method === "block") {
        return jsonResponse({
          result: {
            chunks: [
              {
                chunk_hash: "chunk-1",
                tx_root: "not-empty",
              },
            ],
          },
        })
      }
      if (request.method === "chunk") {
        chunkCalls += 1
        if (chunkCalls === 1) {
          return jsonResponse({ error: { message: "throttled" } }, 429)
        }
        return jsonResponse({
          result: {
            transactions: [
              {
                hash: "tx-1",
                signer_id: "a.testnet",
                receiver_id: "gv.testnet",
              },
            ],
          },
        })
      }
      return jsonResponse({
        result: {
          receipts_outcome: [
            {
              id: "receipt-1",
              outcome: {
                executor_id: "gv.testnet",
                logs: ['{"event":"message"}'],
              },
            },
          ],
        },
      })
    }) as typeof fetch
    const rpc = new NearRpcClient(
      "https://rpc.example",
      "gv.testnet",
      fetchImpl,
      0,
    )

    await expect(rpc.chunkMessages(10)).resolves.toEqual([
      {
        receiptId: "receipt-1",
        executorId: "gv.testnet",
        logs: ['{"event":"message"}'],
      },
    ])
    expect(chunkCalls).toBe(2)
  })
})
