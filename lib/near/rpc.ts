import type { NearConfig } from "./config"

export interface ViewCallOptions {
  contractId: string
  methodName: string
  args?: Record<string, unknown>
}

interface RpcResponse<T> {
  result?: T
  error?: { message?: string; data?: unknown }
}

function base64Json(args: Record<string, unknown>): string {
  const json = JSON.stringify(args)
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64")
  }
  return window.btoa(
    Array.from(new TextEncoder().encode(json), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  )
}

/**
 * Read-only RPC access. This never signs, never sends, and holds no keys.
 */
function rpcUrls(primary: string): string[] {
  return Array.from(
    new Set(
      [
        primary,
        "https://test.rpc.fastnear.com",
        "https://rpc.testnet.near.org",
        "https://testnet.near.lavanet.xyz",
      ].filter(Boolean),
    ),
  )
}

export class NearRpc {
  constructor(private readonly config: NearConfig) {}

  async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const urls = rpcUrls(this.config.rpcUrl)
    let lastError: unknown
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i]!
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "groupvault-web",
            method,
            params,
          }),
        })
        if (!response.ok) {
          throw new Error(`NEAR RPC ${method} failed: HTTP ${response.status}`)
        }
        const body = (await response.json()) as RpcResponse<T>
        if (body.error) {
          const msg = body.error.message ?? "unknown error"
          // Rotate on rate limits; surface other RPC errors immediately.
          if (/429|Rate limit/i.test(msg) || /429/.test(String(body.error.data ?? ""))) {
            throw new Error(`NEAR RPC ${method}: ${msg}`)
          }
          throw new Error(`NEAR RPC ${method}: ${msg}`)
        }
        return body.result as T
      } catch (reason) {
        lastError = reason
        const msg = String(reason)
        if (
          i < urls.length - 1 &&
          /429|Rate limit|HTTP 429|fetch failed|Connect Timeout|UND_ERR/i.test(msg)
        ) {
          await new Promise((r) => setTimeout(r, 600 * (i + 1)))
          continue
        }
        if (i === urls.length - 1) break
        // Non-rate-limit JSON-RPC errors should not silently rotate forever,
        // but a dead endpoint should.
        if (/HTTP 5|fetch failed|Connect Timeout|UND_ERR/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 400))
          continue
        }
        throw reason
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`NEAR RPC ${method} failed across ${urls.length} providers`)
  }

  async view<T>({ contractId, methodName, args = {} }: ViewCallOptions): Promise<T> {
    return this.call<T>("query", {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: methodName,
      args_base64: base64Json(args),
    }).then((result) => {
      const withBytes = result as unknown as { result: number[] }
      const text = new TextDecoder().decode(
        Uint8Array.from(withBytes.result ?? []),
      )
      return (text.length === 0 ? null : JSON.parse(text)) as T
    })
  }

  async accountBalance(accountId: string): Promise<bigint> {
    const result = await this.call<{ amount: string }>("query", {
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    return BigInt(result.amount)
  }

  async transactionStatus(
    txHash: string,
    senderId: string,
  ): Promise<{ success: boolean; receiptIds: string[] }> {
    const result = await this.call<{
      final_execution_status?: string
      status?: { SuccessValue?: string; Failure?: unknown }
      receipts_outcome?: { id: string }[]
    }>("tx", {
      tx_hash: txHash,
      sender_account_id: senderId,
      wait_until: "FINAL",
    })
    const failure = result.status && "Failure" in result.status
    return {
      success: !failure,
      receiptIds: (result.receipts_outcome ?? []).map((item) => item.id),
    }
  }
}

export { base64Json }
