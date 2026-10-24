import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import { test as base, expect, type Page } from "@playwright/test"

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
