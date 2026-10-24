export interface IndexerConfig {
  rpcUrl: string
  contractId: string
  dbPath: string
  /** Explicit start height, or null to resolve the current finalized head. */
  startBlock: number | null
  /** Bounded lookback when startBlock is null. */
  initialBackfillBlocks: number
  port: number
  pollIntervalMs: number
}

function integer(value: string | undefined, name: string, fallback?: number): number {
  if (value === undefined || value.trim() === "") {
    if (fallback !== undefined) return fallback
    throw new Error(`${name} is required`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return parsed
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IndexerConfig {
  const rpcUrl = env.INDEXER_RPC_URL?.trim()
  if (!rpcUrl) throw new Error("INDEXER_RPC_URL is required")

  const contractId = env.GROUPVAULT_CONTRACT_ID?.trim()
  if (!contractId) throw new Error("GROUPVAULT_CONTRACT_ID is required")

  const startRaw = env.INDEXER_START_BLOCK?.trim()
  const startBlock =
    startRaw === undefined || startRaw === ""
      ? null
      : integer(startRaw, "INDEXER_START_BLOCK")

  return {
    rpcUrl,
    contractId,
    dbPath: env.INDEXER_DB_PATH?.trim() || "./data/messages.sqlite",
    startBlock,
    initialBackfillBlocks: integer(
      env.INDEXER_INITIAL_BACKFILL_BLOCKS,
      "INDEXER_INITIAL_BACKFILL_BLOCKS",
      0,
    ),
    port: integer(env.INDEXER_PORT, "INDEXER_PORT", 8787),
    pollIntervalMs: Math.max(
      500,
      integer(env.INDEXER_POLL_INTERVAL_MS, "INDEXER_POLL_INTERVAL_MS", 2000),
    ),
  }
}
