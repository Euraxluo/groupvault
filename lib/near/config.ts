export interface NearConfig {
  network: "testnet" | "mainnet"
  rpcUrl: string
  groupVaultContractId: string
  joinFtContractId: string
  factoryId: string
  indexerUrl: string
}

/**
 * Public, NEXT_PUBLIC_-only configuration. Nothing here is a secret and the
 * app never receives a private key.
 *
 * Each key is accessed with a static literal so the Next.js compiler can
 * inline it into the browser bundle. Dynamic `process.env[name]` access is not
 * inlined and would leave every client value empty.
 */
export function getNearConfig(): NearConfig {
  const network = (process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet").trim()
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(`Unsupported NEXT_PUBLIC_NEAR_NETWORK: ${network}`)
  }

  return {
    network,
    rpcUrl: (
      process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? "https://rpc.testnet.near.org"
    ).trim(),
    groupVaultContractId: (
      process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ?? ""
    ).trim(),
    joinFtContractId: (process.env.NEXT_PUBLIC_JOIN_FT ?? "").trim(),
    factoryId: (
      process.env.NEXT_PUBLIC_FACTORY ?? "sputnikv2.testnet"
    ).trim(),
    indexerUrl: (
      process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://127.0.0.1:8787"
    ).trim(),
  }
}

export function requireGroupVault(config: NearConfig): string {
  if (!config.groupVaultContractId) {
    throw new Error(
      "NEXT_PUBLIC_GROUPVAULT_CONTRACT is not configured; deploy the contract first (T010)",
    )
  }
  return config.groupVaultContractId
}

export const GAS = {
  createGroup: "100000000000000",
  join: "100000000000000",
  chat: "30000000000000",
  convert: "300000000000000",
  ftTransfer: "50000000000000",
  addProposal: "100000000000000",
  actProposal: "300000000000000",
  storageDeposit: "30000000000000",
  delegate: "100000000000000",
} as const

export const ONE_YOCTO = "1"
