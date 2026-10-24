import { readManifest } from "./lib/manifest.js"
import { accountCodeHash, view } from "./lib/near-cli.js"

function parseCheck(argv: string[]): string {
  const index = argv.indexOf("--check")
  const value = index >= 0 ? argv[index + 1] : undefined
  if (!value || !["base", "staking", "all"].includes(value)) {
    throw new Error("--check base|staking|all is required")
  }
  return value
}

async function assertFactoryReachable(): Promise<void> {
  const codeHash = await accountCodeHash("sputnikv2.testnet")
  if (codeHash === "11111111111111111111111111111111") {
    throw new Error("sputnikv2.testnet has no deployed contract code")
  }
}

async function verifyBase(): Promise<void> {
  const manifest = readManifest()
  if (!manifest.groupvault_account_id || !manifest.join_ft_account_id) {
    throw new Error("Base manifest is missing contract account IDs")
  }
  const groups = await view<unknown[]>(manifest.groupvault_account_id, "get_groups", {
    from_index: 0,
    limit: 1,
  })
  if (!Array.isArray(groups)) throw new Error("GroupVault get_groups is not callable")

  const metadata = await view<{ spec?: string; symbol?: string; decimals?: number }>(
    manifest.join_ft_account_id,
    "ft_metadata",
  )
  if (metadata.spec !== "ft-1.0.0" || metadata.symbol !== "GVJOIN") {
    throw new Error("Join FT metadata is not the pinned NEP-141 fixture")
  }
  if (metadata.decimals !== manifest.join_ft_decimals) {
    throw new Error("Join FT decimals do not match the manifest")
  }
  await assertFactoryReachable()
  console.log(
    `[verify] base ok: groupvault=${manifest.groupvault_account_id} ft=${manifest.join_ft_account_id} factory=sputnikv2.testnet`,
  )
}

async function verifyStaking(evidencePath?: string): Promise<void> {
  const manifest = readManifest()
  if (
    !manifest.sputnik_staking_account_id ||
    !manifest.groupvault_account_id ||
    !manifest.join_ft_account_id
  ) {
    throw new Error("Staking manifest is incomplete")
  }
  if (
    manifest.sputnik_staking_source_commit !==
    "5434a59dec23ee0c49df8c8c4350c208a7e75b0b"
  ) {
    throw new Error("Staking source commit is not the reviewed commit")
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.sputnik_staking_wasm_sha256 ?? "")) {
    throw new Error("Staking wasm checksum is missing")
  }

  const groupId = evidencePath
    ? (JSON.parse(
        require("node:fs").readFileSync(evidencePath, "utf8"),
      ) as { group_id?: number }).group_id
    : undefined
  if (groupId === undefined) {
    throw new Error("Staking verification requires --evidence artifacts/demo-input.json")
  }
  const daoId = await view<string | null>(manifest.groupvault_account_id, "get_dao_id", {
    group_id: groupId,
  })
  if (daoId === null) throw new Error("GroupVault has no dao_id for the demo group")

  console.log(
    `[verify] staking ok: staking=${manifest.sputnik_staking_account_id} dao=${daoId} ft=${manifest.join_ft_account_id}`,
  )
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const check = parseCheck(argv)
  const evidenceIndex = argv.indexOf("--evidence")
  const evidencePath = evidenceIndex >= 0 ? argv[evidenceIndex + 1] : undefined

  if (check === "base" || check === "all") await verifyBase()
  if (check === "staking" || check === "all") await verifyStaking(evidencePath)
}

main().catch((error: unknown) => {
  console.error(
    `[verify] ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
