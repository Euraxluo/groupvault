export interface ReceiptOutcome {
  receiptId: string
  executorId: string
  logs: string[]
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
    private readonly contractId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T>(method: string, params: unknown): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "groupvault-indexer",
            method,
            params,
          }),
        })
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`RPC ${method} failed with HTTP ${response.status}`)
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
          continue
        }
        if (!response.ok) {
          throw new Error(`RPC ${method} failed with HTTP ${response.status}`)
        }
        const body = (await response.json()) as JsonRpcResponse
        if (body.error) {
          throw new Error(`RPC ${method} error: ${body.error.message ?? "unknown"}`)
        }
        return body.result as T
      } catch (reason) {
        lastError = reason instanceof Error ? reason : new Error(String(reason))
        if (/HTTP 429|fetch failed|network|timeout/i.test(lastError.message)) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
          continue
        }
        throw lastError
      }
    }
    throw lastError ?? new Error(`RPC ${method} failed`)
  }

  async finalBlockHeight(): Promise<number> {
    const block = await this.call<{ header: { height: number } }>("block", {
      finality: "final",
    })
    return block.header.height
  }

  /**
   * Collect receipt logs for this block. Standard `chunk` receipts do not include
   * execution outcomes, so we resolve transactions that target our contract via
   * `tx` and read `receipts_outcome[].outcome.logs`.
   */
  async chunkMessages(blockHeight: number): Promise<ReceiptOutcome[]> {
    const block = await this.call<{
      chunks: { chunk_hash: string; tx_root?: string }[]
    }>("block", { block_id: blockHeight })

    // Only shards with a non-empty tx_root can contain transactions; an empty
    // root is the all-ones hash. Fetching all ~10 shards per block exceeds the
    // public RPC rate limit, so skip the empty ones (~1-2 shards per block).
    const EMPTY_ROOT = "11111111111111111111111111111111"
    const shards = (block.chunks ?? []).filter(
      (chunk) => chunk.tx_root && chunk.tx_root !== EMPTY_ROOT,
    )

    const chunks = await Promise.all(
      shards.map((chunkRef) =>
        this.call<{
          transactions: {
            hash?: string
            signer_id: string
            receiver_id: string
          }[]
        }>("chunk", { chunk_id: chunkRef.chunk_hash }).catch(() => ({
          transactions: [],
        })),
      ),
    )

    const outcomes: ReceiptOutcome[] = []
    const seen = new Set<string>()
    const relevant: { hash: string; signerId: string }[] = []

    for (const chunk of chunks) {
      for (const tx of chunk.transactions ?? []) {
        if (!tx.hash) continue
        // Direct calls to GroupVault (create/join/send/convert). Skip unrelated traffic.
        if (tx.receiver_id !== this.contractId) continue
        relevant.push({ hash: tx.hash, signerId: tx.signer_id })
      }
    }

    // Resolve receipts concurrently; usually 0-1 relevant txs per block.
    const statuses = await Promise.all(
      relevant.map((tx) =>
        this.call<{
          receipts_outcome?: {
            id: string
            outcome: { executor_id?: string; logs?: string[] }
          }[]
        }>("tx", {
          tx_hash: tx.hash,
          sender_account_id: tx.signerId,
          wait_until: "FINAL",
        }).catch(() => ({ receipts_outcome: [] })),
      ),
    )

    for (const status of statuses) {
        for (const receipt of status.receipts_outcome ?? []) {
          const logs = receipt.outcome?.logs ?? []
          if (logs.length === 0) continue
          if (seen.has(receipt.id)) continue
          seen.add(receipt.id)
          outcomes.push({
            receiptId: receipt.id,
            executorId: receipt.outcome?.executor_id ?? this.contractId,
            logs,
          })
        }
    }
    return outcomes
  }
}
