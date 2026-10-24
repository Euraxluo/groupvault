export interface ReceiptOutcome {
  receiptId: string
  executorId: string
  logs: string[]
}

export interface ChunkView {
  receipts: ReceiptOutcome[]
}

export interface RpcClient {
  finalBlockHeight(): Promise<number>
  chunkMessages(blockHeight: number): Promise<ReceiptOutcome[]>
}

interface JsonRpcResponse {
  result?: unknown
  error?: { message?: string; data?: unknown }
}

export class NearRpcClient implements RpcClient {
  constructor(
    private readonly rpcUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T>(method: string, params: unknown): Promise<T> {
    const response = await this.fetchImpl(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "groupvault-indexer", method, params }),
    })
    if (!response.ok) {
      throw new Error(`RPC ${method} failed with HTTP ${response.status}`)
    }
    const body = (await response.json()) as JsonRpcResponse
    if (body.error) {
      throw new Error(`RPC ${method} error: ${body.error.message ?? "unknown"}`)
    }
    return body.result as T
  }

  async finalBlockHeight(): Promise<number> {
    const block = await this.call<{ header: { height: number } }>("block", {
      finality: "final",
    })
    return block.header.height
  }

  async chunkMessages(blockHeight: number): Promise<ReceiptOutcome[]> {
    const block = await this.call<{
      chunks: { chunk_hash: string }[]
    }>("block", { block_id: blockHeight })

    const outcomes: ReceiptOutcome[] = []
    for (const chunkRef of block.chunks ?? []) {
      const chunk = await this.call<{
        receipts: {
          receipt_id: string;
          receiver_id: string;
          outcome?: { executor_id?: string; logs?: string[] }
        }[]
      }>("chunk", { chunk_id: chunkRef.chunk_hash })

      for (const receipt of chunk.receipts ?? []) {
        const logs = receipt.outcome?.logs ?? []
        if (logs.length === 0) continue
        outcomes.push({
          receiptId: receipt.receipt_id,
          executorId: receipt.outcome?.executor_id ?? receipt.receiver_id,
          logs,
        })
      }
    }
    return outcomes
  }
}
