import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export interface Manifest {
  network: "testnet"
  deployer_account_id: string
  groupvault_account_id?: string
  groupvault_wasm_sha256?: string
  join_ft_account_id?: string
  join_ft_wasm_sha256?: string
  join_ft_decimals?: number
  factory_id: "sputnikv2.testnet"
  deployed_at?: string
  sputnik_staking_account_id?: string
  sputnik_staking_source_commit?: string
  sputnik_staking_wasm_sha256?: string
  deployments: {
    groupvault?: string
    join_ft?: string
    staking?: string
  }
}

export const ROOT = process.cwd()
export const MANIFEST_PATH = join(ROOT, "deployments", "testnet.json")

export function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Missing ${MANIFEST_PATH}; run pnpm deploy:testnet -- --phase base first`,
    )
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest
  assertNoSecrets(manifest)
  return manifest
}

export function writeManifest(manifest: Manifest): void {
  assertNoSecrets(manifest)
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

export function assertNoSecrets(value: unknown): void {
  const raw = JSON.stringify(value)
  if (
    /ed25519:|BEGIN [A-Z ]*PRIVATE|PRIVATE_KEY|SECRET|SEED_PHRASE|TODO/.test(
      raw,
    )
  ) {
    throw new Error("Manifest contains a secret or placeholder")
  }
}

export function requirePublicValue(
  manifest: Manifest,
  key: keyof Manifest,
): string {
  const value = manifest[key]
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Manifest is missing ${String(key)}`)
  }
  return value
}
