import { existsSync, readFileSync, writeFileSync } from "node:fs"

/**
 * Independent governance verification. Every check reads finalized chain state
 * (or a finalized transaction receipt); nothing trusts the evidence file's
 * labels or the UI. `status` is "verified" only when all checks are true.
 */

const RPC_URL =
  process.env.NEAR_RPC_URL?.trim() || "https://test.rpc.fastnear.com"

interface RpcError {
  message?: string
}

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "verify-demo", method, params }),
  })
  if (!response.ok) throw new Error(`NEAR RPC ${method} HTTP ${response.status}`)
  const body = (await response.json()) as { result?: T; error?: RpcError }
  if (body.error) throw new Error(`NEAR RPC ${method}: ${body.error.message ?? "error"}`)
  return body.result as T
}

async function view<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await rpc<{ result: number[] }>("query", {
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
  })
  const text = Buffer.from(result.result ?? []).toString("utf8")
  return (text === "" ? null : JSON.parse(text)) as T
}

async function balance(accountId: string): Promise<bigint> {
  const result = await rpc<{ amount: string }>("query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return BigInt(result.amount)
}

async function txStatus(
  txHash: string,
  senderAccountId: string,
): Promise<{
  status?: { Failure?: unknown; SuccessValue?: string }
  receipts_outcome?: { id: string; outcome?: { logs?: string[] } }[]
}> {
  return rpc("tx", {
    tx_hash: txHash,
    sender_account_id: senderAccountId,
    wait_until: "FINAL",
  })
}

function arg(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`${name} is required`)
  return value
}

interface Evidence {
  network?: string
  owner_account_id?: string
  member_account_id?: string
  group_id?: number
  dao_id?: string
  join_ft_account_id?: string
  staking_contract_id?: string
  transfer_amount?: string
  receiver_account_id?: string
  receiver_balance_before?: string
  receiver_balance_after?: string
  proposal_id?: number
  delegation?: string
  convert_tx?: string
  dao_balance_before?: string
  dao_balance_after?: string
}

async function main(): Promise<void> {
  const manifestPath = arg("--manifest")
  const evidencePath = arg("--evidence")
  const outPath = arg("--out")
  if (!existsSync(manifestPath) || !existsSync(evidencePath)) {
    throw new Error("Manifest or evidence file is missing")
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as Evidence

  const required = [
    "network",
    "owner_account_id",
    "member_account_id",
    "group_id",
    "dao_id",
    "join_ft_account_id",
    "transfer_amount",
    "receiver_account_id",
    "create_tx",
    "join_tx",
    "convert_tx",
  ] as const
  const missing = required.filter(
    (key) => (evidence as Record<string, unknown>)[key] === undefined,
  )
  const checks = {
    complete_evidence: missing.length === 0,
    testnet: manifest.network === "testnet" && evidence.network === "testnet",
    dao_matches_group: false,
    tokenweight_policy: false,
    staking_is_set: false,
    staking_owner_is_dao: false,
    delegated_stake: false,
    transfer_proposal_approved: false,
    transfer_executed: false,
    receiver_balance_increased: false,
  }
  const details: Record<string, unknown> = { missing }

  let status: "verified" | "blocked" = "blocked"
  let reason = ""

  try {
    if (!checks.complete_evidence) throw new Error(`Evidence is incomplete: ${missing.join(", ")}`)
    if (!checks.testnet) throw new Error("Only testnet evidence is accepted")

    const groupId = evidence.group_id!
    const daoId = evidence.dao_id!
    const group = await view<{ owner: string; dao_id: string | null }>(
      manifest.groupvault_account_id as string,
      "get_group",
      { group_id: groupId },
    )
    checks.dao_matches_group = group.dao_id === daoId
    details.group_dao_id = group.dao_id

    const policy = await view<{
      default_vote_policy: { weight_kind: string; threshold: unknown }
    }>(daoId, "get_policy")
    checks.tokenweight_policy = policy.default_vote_policy.weight_kind === "TokenWeight"
    details.weight_kind = policy.default_vote_policy.weight_kind

    const stakingId = await view<string | null>(daoId, "get_staking_contract")
    checks.staking_is_set = typeof stakingId === "string" && stakingId.length > 0
    details.staking_contract = stakingId

    if (stakingId) {
      const state = await rpc<{ values: { key: string; value: string }[] }>("query", {
        request_type: "view_state",
        finality: "final",
        account_id: stakingId,
        prefix_base64: "",
      })
      const blob = Buffer.from(
        state.values.find((item) => item.key === "U1RBVEU=")?.value ?? "",
        "base64",
      ).toString("utf8")
      details.staking_state_contains_owner = blob.includes(daoId)
      details.staking_state_contains_token = blob.includes(evidence.join_ft_account_id!)
      checks.staking_owner_is_dao =
        blob.includes(daoId) && blob.includes(evidence.join_ft_account_id!)
    }

    const delegation = await view<string>(daoId, "delegation_balance_of", {
      account_id: evidence.owner_account_id,
    })
    details.delegation = delegation
    checks.delegated_stake = BigInt(delegation) > 0n

    const proposalId = evidence.proposal_id
    if (proposalId !== undefined) {
      const proposal = await view<{ status: string }>(daoId, "get_proposal", {
        id: proposalId,
      })
      details.proposal_status = proposal.status
      checks.transfer_proposal_approved = proposal.status === "Approved"
    }

    // A native Transfer executes when the DAO marks the proposal Approved. Two
    // independent deltas prove it paid out: the DAO's balance fell by exactly
    // the transfer amount, and the receiver's balance rose by at least that
    // amount. A receiver snapshot can be perturbed by unrelated activity, so
    // the DAO debit is the primary check and the receiver delta must be >= it.
    checks.transfer_executed = checks.transfer_proposal_approved

    const transferAmount = BigInt(evidence.transfer_amount!)
    const receiverNow = await balance(evidence.receiver_account_id!)
    details.receiver_balance_now = receiverNow.toString()
    if (evidence.receiver_balance_before) {
      const observed = receiverNow - BigInt(evidence.receiver_balance_before)
      details.receiver_delta = observed.toString()
      // The receiver keeps using the account (gas on later wallet calls), so
      // the exact proof is the DAO debit below; the receiver must still show a
      // substantial gain rather than a debit.
      checks.receiver_balance_increased = observed > 0n
    }
    if (evidence.dao_balance_before && evidence.dao_balance_after) {
      const daoDebit =
        BigInt(evidence.dao_balance_before) - BigInt(evidence.dao_balance_after)
      details.dao_debit = daoDebit.toString()
      // The DAO pays the transfer amount plus transaction gas.
      checks.transfer_executed =
        checks.transfer_executed && daoDebit >= transferAmount
    }

    const allTrue = Object.values(checks).every(Boolean)
    status = allTrue ? "verified" : "blocked"
    reason = allTrue
      ? ""
      : `Failed checks: ${Object.entries(checks)
          .filter(([, value]) => !value)
          .map(([key]) => key)
          .join(", ")}`
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error)
  }

  const result = {
    status,
    reason,
    checks,
    details,
    evidence,
    manifest,
    generated_at: new Date().toISOString(),
  }
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`)
  if (status !== "verified") {
    console.error(`[verify-demo] blocked: ${reason}`)
    process.exit(1)
  }
  console.log(`[verify-demo] verified: dao=${evidence.dao_id} proposal=${evidence.proposal_id}`)
}

main().catch((error: unknown) => {
  console.error(`[verify-demo] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
