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
export class NearRpc {
  constructor(private readonly config: NearConfig) {}

  async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.config.rpcUrl, {
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
      throw new Error(
        `NEAR RPC ${method}: ${body.error.message ?? "unknown error"}`,
      )
    }
    return body.result as T
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
