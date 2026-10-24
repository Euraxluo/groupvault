import { existsSync, readFileSync, writeFileSync } from "node:fs"

function arg(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`${name} is required`)
  return value
}

function main(): void {
  const manifestPath = arg("--manifest")
  const evidencePath = arg("--evidence")
  const outPath = arg("--out")

  if (!existsSync(manifestPath) || !existsSync(evidencePath)) {
    throw new Error("Manifest or evidence file is missing")
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
    string,
    unknown
  >
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as Record<
    string,
    unknown
  >

  const required = [
    "network",
    "owner_account_id",
    "member_account_id",
    "group_id",
    "dao_id",
    "join_ft_account_id",
    "join_fee",
    "stake_amount",
    "receiver_account_id",
    "transfer_amount",
    "create_tx",
    "join_tx",
    "convert_tx",
  ]
  const missing = required.filter((key) => evidence[key] === undefined)
  if (missing.length > 0) {
    throw new Error(`Evidence is incomplete: missing ${missing.join(", ")}`)
  }
  if (manifest.network !== "testnet" || evidence.network !== "testnet") {
    throw new Error("Only testnet evidence is accepted")
  }

  // Chain re-verification is implemented by verify-testnet. This command must
  // not claim verified just because the JSON exists.
  const result = {
    status: "blocked" as const,
    reason:
      "Independent chain checks for governance, delegation, and receiver balance require the live T013 run; evidence alone is not proof.",
    checks: {
      tokenweight_policy: false,
      delegated_stake: false,
      transfer_executed: false,
      receiver_balance_increased: false,
    },
    evidence,
    manifest,
    generated_at: new Date().toISOString(),
  }
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`)
  console.error(`[verify-demo] blocked: ${result.reason}`)
  process.exit(1)
}

main()
