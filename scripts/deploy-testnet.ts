import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  MANIFEST_PATH,
  ROOT,
  readManifest,
  requirePublicValue,
  writeManifest,
  type Manifest,
} from "./lib/manifest.js"
import {
  accountCodeHash,
  call,
  createFaucetAccount,
  deployContract,
  near,
  view,
} from "./lib/near-cli.js"
import { deploySubaccount, stakingAccountId } from "./lib/keypair-deploy.js"

const FACTORY = "sputnikv2.testnet" as const
const JOIN_FT_DECIMALS = 6
const GROUPVAULT_WASM = join(ROOT, "artifacts", "wasm", "groupvault_contract.wasm")
const JOIN_FT_WASM = join(ROOT, "artifacts", "wasm", "groupvault_join_ft.wasm")

function parseArgs(argv: string[]): { phase: string; groupId?: number } {
  let phase = ""
  let groupId: number | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--phase") phase = argv[++index] ?? ""
    else if (value === "--group-id") groupId = Number(argv[++index])
  }
  if (!phase) throw new Error("--phase base|ft|staking is required")
  return { phase, groupId }
}

function sha256(path: string): string {
  if (!existsSync(path)) throw new Error(`Missing wasm ${path}; run scripts/build-contracts.sh`)
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

async function hasContractCode(accountId: string): Promise<boolean> {
  // `near state` prints JavaScript's inspect format (single quotes), so it is
  // not JSON. Read the code_hash line instead of parsing the whole object.
  const codeHash = await accountCodeHash(accountId)
  return codeHash !== "11111111111111111111111111111111"
}

function loadManifestForDeploy(): Manifest {
  if (existsSync(MANIFEST_PATH)) return readManifest()
  const deployer = process.env.NEAR_DEPLOYER_ACCOUNT?.trim()
  if (!deployer) {
    throw new Error(
      "NEAR_DEPLOYER_ACCOUNT is required for the first deployment (an account whose credentials already exist in NEAR CLI)",
    )
  }
  return {
    network: "testnet",
    deployer_account_id: deployer,
    factory_id: FACTORY,
    deployments: {},
  }
}

function writeLocalEnv(manifest: Manifest): void {
  if (!manifest.groupvault_account_id || !manifest.join_ft_account_id) return
  const content = `NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.testnet.near.org
NEXT_PUBLIC_GROUPVAULT_CONTRACT=${manifest.groupvault_account_id}
NEXT_PUBLIC_JOIN_FT=${manifest.join_ft_account_id}
NEXT_PUBLIC_FACTORY=sputnikv2.testnet
NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8787
`
  writeFileSync(join(ROOT, ".env.local"), content)
}

function ensureCredentials(accountId: string): void {
  const result = view<unknown>(accountId, "get_groups", { from_index: 0, limit: 1 })
  void result
}

async function deployBase(manifest: Manifest): Promise<void> {
  const account =
    manifest.groupvault_account_id ??
    process.env.NEAR_GROUPVAULT_ACCOUNT?.trim() ??
    `${manifest.deployer_account_id.split(".")[0]}-groupvault.testnet`
  const wasmSha = sha256(GROUPVAULT_WASM)
  let tx = manifest.deployments.groupvault ?? ""
  if (await hasContractCode(account)) {
    console.log(`[deploy] base contract already present at ${account}; verifying only`)
  } else {
    createFaucetAccount(account)
    tx = deployContract({
      accountId: account,
      wasmPath: GROUPVAULT_WASM,
      initFunction: "new",
      initArgs: {
        owner: manifest.deployer_account_id,
        factory_id: FACTORY,
      },
    })
  }

  // Real cross-contract-free views must be readable immediately.
  const groups = await view<unknown[]>(account, "get_groups", {
    from_index: 0,
    limit: 1,
  })
  if (!Array.isArray(groups)) throw new Error("get_groups did not return an array")

  manifest.groupvault_account_id = account
  manifest.groupvault_wasm_sha256 = wasmSha
  manifest.deployments.groupvault = tx
  manifest.deployed_at = new Date().toISOString()
  writeManifest(manifest)
  console.log(`[deploy] base ok: ${account} tx=${tx}`)
}

async function deployFt(manifest: Manifest): Promise<void> {
  if (!manifest.groupvault_account_id) {
    throw new Error("Base phase must run before the FT phase")
  }
  const account =
    manifest.join_ft_account_id ??
    process.env.NEAR_JOIN_FT_ACCOUNT?.trim() ??
    `${manifest.deployer_account_id.split(".")[0]}-ft.testnet`
  const wasmSha = sha256(JOIN_FT_WASM)
  let tx = manifest.deployments.join_ft ?? ""
  if (await hasContractCode(account)) {
    console.log(`[deploy] join FT already present at ${account}; verifying only`)
  } else {
    createFaucetAccount(account)
    tx = deployContract({
      accountId: account,
      wasmPath: JOIN_FT_WASM,
      initFunction: "new",
      initArgs: {
        owner: manifest.deployer_account_id,
        name: "GroupVault Join Token",
        symbol: "GVJOIN",
        decimals: JOIN_FT_DECIMALS,
      },
    })
  }

  const metadata = await view<{ symbol?: string; decimals?: number }>(account, "ft_metadata")
  if (metadata.symbol !== "GVJOIN" || metadata.decimals !== JOIN_FT_DECIMALS) {
    throw new Error("FT metadata did not match the deployed fixture")
  }

  manifest.join_ft_account_id = account
  manifest.join_ft_wasm_sha256 = wasmSha
  manifest.join_ft_decimals = JOIN_FT_DECIMALS
  manifest.deployments.join_ft = tx
  writeManifest(manifest)
  writeLocalEnv(manifest)
  console.log(`[deploy] ft ok: ${account} tx=${tx}`)
  console.log(
    `[deploy] demo mint (deployer only): near call ${account} mint '{"account_id":"<wallet>","amount":"<base-units>"}' --accountId ${manifest.deployer_account_id} --depositYocto 1`,
  )
}

async function deployStaking(manifest: Manifest, groupId: number | undefined): Promise<void> {
  if (groupId === undefined || !Number.isSafeInteger(groupId)) {
    throw new Error("--group-id is required for the staking phase")
  }
  if (!manifest.groupvault_account_id || !manifest.join_ft_account_id) {
    throw new Error("Base and FT phases must run before staking")
  }
  const daoId = await view<string | null>(manifest.groupvault_account_id, "get_dao_id", {
    group_id: groupId,
  })
  if (!daoId) {
    throw new Error(`Group ${groupId} has no dao_id; complete the browser Convert first`)
  }

  const sourcePath = join(ROOT, "deployments", "staking-source.json")
  if (!existsSync(sourcePath)) {
    throw new Error(
      "Missing deployments/staking-source.json (created by the pinned staking build task T012)",
    )
  }
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as {
    commit: string
    wasm_path: string
    wasm_sha256: string
  }
  const expectedCommit = "5434a59dec23ee0c49df8c8c4350c208a7e75b0b"
  if (source.commit !== expectedCommit) {
    throw new Error(`Staking source commit must be ${expectedCommit}`)
  }
  const actualSha = sha256(join(ROOT, source.wasm_path))
  if (actualSha !== source.wasm_sha256) {
    throw new Error("Staking wasm checksum does not match staking-source.json")
  }

  const account =
    manifest.sputnik_staking_account_id ??
    stakingAccountId(manifest.deployer_account_id)
  if (manifest.sputnik_staking_account_id) {
    throw new Error(
      `Staking was already deployed at ${manifest.sputnik_staking_account_id}; refusing to redeploy`,
    )
  }

  // near-cli cannot reach a working RPC on this host; sign with the deployer
  // keypair, create a real subaccount, deploy, and initialize `new`.
  const tx = await deploySubaccount({
    deployer: manifest.deployer_account_id,
    accountId: account,
    wasmPath: join(ROOT, source.wasm_path),
    initFunction: "new",
    initArgs: {
      owner_id: daoId,
      token_id: manifest.join_ft_account_id,
      unstake_period: "604800000000000",
    },
  })

  manifest.sputnik_staking_account_id = account
  manifest.sputnik_staking_source_commit = source.commit
  manifest.sputnik_staking_wasm_sha256 = source.wasm_sha256
  manifest.deployments.staking = tx
  writeManifest(manifest)
  console.log(`[deploy] staking ok: ${account} owner=${daoId} tx=${tx}`)
}

async function main(): Promise<void> {
  const { phase, groupId } = parseArgs(process.argv.slice(2))
  const manifest = loadManifestForDeploy()
  if (manifest.factory_id !== FACTORY) {
    throw new Error(`Manifest factory_id must be ${FACTORY}`)
  }
  if (manifest.network !== "testnet") throw new Error("Only NEAR testnet is allowed")

  if (phase === "base") await deployBase(manifest)
  else if (phase === "ft") await deployFt(manifest)
  else if (phase === "staking") await deployStaking(manifest, groupId)
  else throw new Error(`Unknown phase ${phase}`)

  requirePublicValue(readManifest(), "groupvault_account_id")
  void ensureCredentials
}

main().catch((error: unknown) => {
  console.error(`[deploy] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
