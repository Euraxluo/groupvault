import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import { test as base, expect, type Page } from "@playwright/test"

export interface SentTransaction {
  hash: string
  signerId: string
  receiverId: string
  methodName: string
  receiptIds: string[]
}

/** Collect real signed transactions the browser broadcasts to NEAR RPC. */
export function recordSentTransactions(page: Page): SentTransaction[] {
  const sent: SentTransaction[] = []
  page.on("response", async (response) => {
    const request = response.request()
    if (request.method() !== "POST") return
    if (!/jsonrpc|near/.test(request.url())) return
    const payload = request.postData()
    if (!payload || !payload.includes("send_tx")) return
    try {
      const body = (await response.json()) as {
        result?: {
          receipts_outcome?: { id?: string }[]
          transaction?: {
            hash?: string
            signer_id?: string
            receiver_id?: string
            actions?: {
              FunctionCall?: { method_name?: string }
              Transfer?: unknown
            }[]
          }
        }
      }
      const tx = body.result?.transaction
      if (!tx?.hash || !tx.signer_id) return
      const first = tx.actions?.[0]
      sent.push({
        hash: tx.hash,
        signerId: tx.signer_id,
        receiverId: tx.receiver_id ?? "",
        // Native transfers have no method name; label them so tests can wait
        // for them without mistaking them for FunctionCall transactions.
        methodName:
          first?.FunctionCall?.method_name ??
          (first?.Transfer !== undefined ? "Transfer" : ""),
        receiptIds: (body.result?.receipts_outcome ?? [])
          .map((receipt) => receipt.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      })
    } catch {
      // Non-JSON or aborted responses are ignored; only confirmed txs count.
    }
  })
  return sent
}

export function lastTxFor(
  sent: SentTransaction[],
  signerId: string,
  methodName: string,
): string | undefined {
  return [...sent]
    .reverse()
    .find((tx) => tx.signerId === signerId && tx.methodName === methodName)?.hash
}

export function lastReceiptIdsFor(
  sent: SentTransaction[],
  signerId: string,
  methodName: string,
): string[] {
  return (
    [...sent]
      .reverse()
      .find((tx) => tx.signerId === signerId && tx.methodName === methodName)
      ?.receiptIds ?? []
  )
}

export interface DemoEvidence {
  network: "testnet"
  owner_account_id: string
  member_account_id: string
  group_id?: number
  dao_id?: string
  join_ft_account_id: string
  join_fee: string
  stake_amount: string
  receiver_account_id: string
  transfer_amount: string
  create_tx?: string
  join_tx?: string
  convert_tx?: string
  message_receipt_ids?: string[]
  // T013 governance evidence
  staking_contract_id?: string
  set_staking_tx?: string
  set_staking_proposal_id?: number
  tokenweight_policy_tx?: string
  tokenweight_proposal_id?: number
  delegation?: string
  delegation_before?: string
  stake_tx?: string
  delegate_tx?: string
  dao_fund_tx?: string
  transfer_proposal_tx?: string
  proposal_id?: number
  proposal_status_before_approve?: string
  zero_weight_rejected?: boolean
  proposal_status_after_rejection?: string
  transfer_approve_tx?: string
  proposal_status_after_approve?: string
  receiver_balance_before?: string
  receiver_balance_after?: string
  recorded_at?: string
}

const EVIDENCE_PATH = join(process.cwd(), "artifacts", "demo-input.json")

export function loadEvidence(): DemoEvidence {
  if (!existsSync(EVIDENCE_PATH)) {
    throw new Error(
      "Missing artifacts/demo-input.json. Run the stepwise demo first (see tests/e2e/README.md).",
    )
  }
  return JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) as DemoEvidence
}

export function saveEvidence(evidence: DemoEvidence): void {
  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true })
  writeFileSync(
    EVIDENCE_PATH,
    `${JSON.stringify({ ...evidence, recorded_at: new Date().toISOString() }, null, 2)}\n`,
  )
}

/**
 * Start a run from a clean evidence file. Steps then add only the fields they
 * truly produced, so a previous run's group/DAO/tx can never leak into this
 * run's evidence (e.g. a stale `dao_id` pointing at another group's DAO).
 */
export function resetEvidence(evidence: DemoEvidence): void {
  saveEvidence({ ...evidence })
}

export const test = base.extend<{ evidence: DemoEvidence | null }>({
  evidence: async ({}, provide) => {
    await provide(existsSync(EVIDENCE_PATH) ? loadEvidence() : null)
  },
})

export { expect }

export async function attachTransaction(page: Page, txHash: string): Promise<void> {
  await test.info().attach(`tx-${txHash}`, {
    body: JSON.stringify({ network: "testnet", tx_hash: txHash }),
    contentType: "application/json",
  })
}

export function envAccount(name: "A" | "B"): string {
  const value = process.env[name === "A" ? "DEMO_ACCOUNT_A" : "DEMO_ACCOUNT_B"]
  if (!value) {
    throw new Error(
      `DEMO_ACCOUNT_${name} must be set to the public testnet account ID for this run`,
    )
  }
  return value
}
