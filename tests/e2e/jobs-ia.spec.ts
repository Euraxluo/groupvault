import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join } from "node:path"

import {
  expect,
  lastReceiptIdsFor,
  lastTxFor,
  recordSentTransactions,
  test,
  type SentTransaction,
} from "./fixtures"
import { connectWalletForDemo, waitForWalletApproval } from "./wallet"
import { expectDao, expectMember, nearBalance, viewCall } from "./evidence"
import type { Page } from "@playwright/test"

const CONTRACT = process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ?? ""
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://127.0.0.1:8787"
const ACCOUNT_A = process.env.DEMO_ACCOUNT_A ?? ""
const ACCOUNT_B = process.env.DEMO_ACCOUNT_B ?? ""
const EVIDENCE_PATH = (() => {
  const configured =
    process.env.JOBS_IA_EVIDENCE_PATH?.trim() || "artifacts/jobs-ia-e2e.json"
  if (/demo-input\.json$/.test(configured)) {
    throw new Error(
      "JOBS_IA_EVIDENCE_PATH must not point at artifacts/demo-input.json; Jobs IA keeps its own evidence",
    )
  }
  return isAbsolute(configured) ? configured : join(process.cwd(), configured)
})()
const RESULT_PATH = join(dirname(EVIDENCE_PATH), "jobs-ia-e2e-result.json")

interface JobsEvidence {
  network: "testnet"
  owner_account_id: string
  member_account_id: string
  group_id?: number
  group_owner?: string
  join_fee?: string
  join_ft_account_id?: string
  create_tx?: string
  join_tx?: string
  message_text?: string
  message_receipt_ids?: string[]
  chat_tx?: string
  message_on_chain?: boolean
  convert_tx?: string
  dao_id?: string
  treasury_native_balance?: string
  back_to_chat?: boolean
  back_url?: string
  indexed_message?: boolean
  independent_reads?: Record<string, unknown>
  recorded_at?: string
}

interface JobsResult {
  status: "verified" | "partial" | "blocked"
  group_id: number | null
  dao_id: string | null
  back_to_chat: boolean
  indexed_message: boolean
  reasons: string[]
  created_at: string
}

function readEvidence(): JobsEvidence {
  if (!existsSync(EVIDENCE_PATH)) {
    throw new Error(
      `Missing ${EVIDENCE_PATH}. Run the "A creates" step first (JOBS_IA_EVIDENCE_PATH controls the path).`,
    )
  }
  return JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) as JobsEvidence
}

function writeEvidence(next: JobsEvidence): JobsEvidence {
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true })
  const value = { ...next, recorded_at: new Date().toISOString() }
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(value, null, 2)}\n`)
  return value
}

function resetEvidence(seed: JobsEvidence): JobsEvidence {
  return writeEvidence(seed)
}

function writeResult(result: JobsResult): void {
  mkdirSync(dirname(RESULT_PATH), { recursive: true })
  writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`)
}

async function confirmedTx(
  page: Page,
  sent: SentTransaction[],
  signerId: string,
  methodName: string,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const hash = lastTxFor(sent, signerId, methodName)
    if (hash) return hash
    await page.waitForTimeout(500)
  }
  throw new Error(`No confirmed ${methodName} transaction observed for ${signerId}`)
}

async function indexerMessage(
  page: Page,
  groupId: number,
  sender: string,
  text: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await page.request.get(
      `${INDEXER_URL}/messages?group_id=${groupId}`,
    )
    if (response.ok()) {
      const body = (await response.json()) as {
        items?: { text?: string; sender?: string; receipt_id?: string }[]
      }
      if (
        (body.items ?? []).some(
          (item) =>
            item.text === text &&
            item.sender === sender &&
            typeof item.receipt_id === "string" &&
            item.receipt_id.length > 0,
        )
      ) {
        return true
      }
    }
    await page.waitForTimeout(3000)
  }
  return false
}

/**
 * Independent chain read of the published chat log. The indexer can lag far
 * behind (known RPC 422 on :8787), so chain logs are the authoritative chat
 * evidence and the indexer render is reported separately.
 */
async function chainMessageLogs(
  page: Page,
  txHash: string,
  text: string,
): Promise<boolean> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_NEAR_RPC_URL?.trim() ||
    "https://testnet-rpc.intea.rs"
  const response = await page.request.post(rpcUrl, {
    data: {
      jsonrpc: "2.0",
      id: "jobs-ia-chain-log",
      method: "tx",
      params: { tx_hash: txHash, sender_account_id: ACCOUNT_A, wait_until: "FINAL" },
    },
  })
  if (!response.ok()) return false
  const body = (await response.json()) as {
    result?: {
      receipts_outcome?: { outcome?: { logs?: string[] } }[]
    }
  }
  return (body.result?.receipts_outcome ?? []).some((receipt) =>
    (receipt.outcome?.logs ?? []).some((log) => log.includes(text)),
  )
}

test.describe.configure({ mode: "serial" })

test.describe("Jobs IA — 发现/新建 → 付费进群 → 聊天 → 升级DAO → 金库 → 回到聊天", () => {
  test("A creates a fresh paid group with a human 入群币 fee", async ({
    page,
    context,
  }) => {
    test.skip(
      process.env.DEMO_PHASE !== "through-convert",
      "set DEMO_PHASE=through-convert to run the live journey",
    )
    expect(CONTRACT).not.toBe("")
    expect(ACCOUNT_A).not.toBe("")
    const sent = recordSentTransactions(page)

    await page.goto("/chat", { waitUntil: "domcontentloaded" })
    await connectWalletForDemo(page, "A")
    await page.goto("/groups/new", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { level: 1, name: "新建群" }),
    ).toBeVisible()

    await page.getByLabel("群名").fill(`Jobs IA ${Date.now().toString(36)}`)
    await page.getByLabel("入群费（入群币）").fill("1")
    await page.getByRole("button", { name: "创建", exact: true }).click()
    await waitForWalletApproval(page, "create_group")

    await expect(page).toHaveURL(/\/groups\/\d+\/chat$/, { timeout: 90_000 })
    const groupId = Number(
      new URL(page.url()).pathname.split("/").filter(Boolean)[1],
    )
    expect(Number.isSafeInteger(groupId)).toBe(true)
    expect(groupId).toBeGreaterThan(16)

    const createTx = await confirmedTx(page, sent, ACCOUNT_A, "create_group")
    const group = await viewCall<{
      owner: string
      join_fee: string
      join_ft: string
      dao_id: string | null
      convert_pending: boolean
    }>(context.request, CONTRACT, "get_group", { group_id: groupId })
    expect(group.owner).toBe(ACCOUNT_A)
    expect(group.dao_id).toBeNull()
    expect(group.convert_pending).toBe(false)

    resetEvidence({
      network: "testnet",
      owner_account_id: ACCOUNT_A,
      member_account_id: ACCOUNT_B,
      group_id: groupId,
      group_owner: group.owner,
      join_fee: group.join_fee,
      join_ft_account_id: group.join_ft,
      create_tx: createTx,
    })
    writeResult({
      status: "partial",
      group_id: groupId,
      dao_id: null,
      back_to_chat: false,
      indexed_message: false,
      reasons: ["journey in progress"],
      created_at: new Date().toISOString(),
    })
  })

  test("B pays the join fee from 发现 with an isolated browser storage", async ({
    browser,
    context,
  }) => {
    test.skip(
      process.env.DEMO_PHASE !== "through-convert",
      "set DEMO_PHASE=through-convert to run the live journey",
    )
    const evidence = readEvidence()
    if (!evidence.group_id) throw new Error("Run the create step first")

    // A separate context = separate storage; B must never inherit A's session.
    const bContext = await browser.newContext()
    const page = await bContext.newPage()
    const sent = recordSentTransactions(page)
    try {
      await page.goto("/discover", { waitUntil: "domcontentloaded" })
      const row = page.locator(`a[href="/groups/${evidence.group_id}/join"]`)
      await expect(row).toBeVisible({ timeout: 60_000 })
      await expect(row).toContainText("入群币")
      await row.click()
      await expect(page).toHaveURL(
        new RegExp(`/groups/${evidence.group_id}/join$`),
      )

      await connectWalletForDemo(page, "B")
      const payButton = page.getByRole("button", {
        name: /支付 .* 入群币并加入/,
      })
      await expect(payButton).toBeEnabled({ timeout: 60_000 })
      await payButton.click()
      await waitForWalletApproval(page, "ft_transfer_call join")
      await expect(page.getByRole("link", { name: "进入群聊" })).toBeVisible({
        timeout: 120_000,
      })

      const joinTx = await confirmedTx(
        page,
        sent,
        evidence.member_account_id,
        "ft_transfer_call",
      )
      await expectMember(
        context.request,
        CONTRACT,
        evidence.group_id,
        evidence.member_account_id,
      )
      writeEvidence({ ...evidence, join_tx: joinTx })
    } finally {
      await bContext.close()
    }
  })

  test("A sends a public chat message with a real chain log", async ({
    page,
  }) => {
    test.skip(
      process.env.DEMO_PHASE !== "through-convert",
      "set DEMO_PHASE=through-convert to run the live journey",
    )
    const evidence = readEvidence()
    if (!evidence.group_id) throw new Error("Run the create step first")
    const sent = recordSentTransactions(page)

    await page.goto(`/groups/${evidence.group_id}/chat`, {
      waitUntil: "domcontentloaded",
    })
    await connectWalletForDemo(page, "A")
    const text = `Jobs IA public chat ${Date.now()}`
    const box = page.getByPlaceholder("写一条公开消息…")
    await expect(box).toBeVisible({ timeout: 60_000 })
    await box.fill(text)
    await page.getByRole("button", { name: "发送", exact: true }).click()
    await waitForWalletApproval(page, "send_message")

    const sendTx = await confirmedTx(
      page,
      sent,
      evidence.owner_account_id,
      "send_message",
    )
    const receipts = lastReceiptIdsFor(
      sent,
      evidence.owner_account_id,
      "send_message",
    )
    // Chain logs prove the message was published; the indexer render is a
    // separate, honest signal (it can lag behind on this machine).
    const onChain = await chainMessageLogs(page, sendTx, text)
    const indexed = await indexerMessage(
      page,
      evidence.group_id,
      evidence.owner_account_id,
      text,
      120_000,
    )
    const health = await page.request.get(`${INDEXER_URL}/health`)
    const healthBody = health.ok() ? await health.json() : null

    writeEvidence({
      ...evidence,
      message_text: text,
      message_receipt_ids: receipts,
      chat_tx: sendTx,
      message_on_chain: onChain,
      indexed_message: indexed,
      independent_reads: {
        ...(evidence.independent_reads ?? {}),
        indexer_health: healthBody,
        message_receipt_count: receipts.length,
      },
    })
    expect(receipts.length).toBeGreaterThan(0)
    expect(onChain).toBe(true)
  })

  test("A converts the group and the chain confirms a DAO id", async ({
    page,
    context,
  }) => {
    test.skip(
      process.env.DEMO_PHASE !== "through-convert",
      "set DEMO_PHASE=through-convert to run the live journey",
    )
    const evidence = readEvidence()
    if (!evidence.group_id) throw new Error("Run the create step first")
    const sent = recordSentTransactions(page)

    await page.goto(`/groups/${evidence.group_id}/convert`, {
      waitUntil: "domcontentloaded",
    })
    await connectWalletForDemo(page, "A")
    await expect(
      page.getByRole("heading", { level: 1, name: "升级为 DAO" }),
    ).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/约 10 NEAR/)).toBeVisible()

    const confirm = page.getByRole("button", { name: "确认升级" })
    await expect(confirm).toBeEnabled({ timeout: 60_000 })
    await confirm.click()
    await waitForWalletApproval(page, "convert_to_dao")

    const convertTx = await confirmedTx(
      page,
      sent,
      evidence.owner_account_id,
      "convert_to_dao",
    )
    const daoId = await expectDao(
      context.request,
      CONTRACT,
      evidence.group_id,
    )
    // The UI must land on the glance only after the chain read returned an id.
    await expect(page).toHaveURL(
      new RegExp(`/dao/${daoId.replace(/\./g, "\\.")}/treasury\\?from=convert`),
      { timeout: 120_000 },
    )
    writeEvidence({ ...evidence, convert_tx: convertTx, dao_id: daoId })
  })

  test("treasury shows a real balance and 回到聊天 returns to the group", async ({
    page,
    context,
  }) => {
    test.skip(
      process.env.DEMO_PHASE !== "through-convert",
      "set DEMO_PHASE=through-convert to run the live journey",
    )
    const evidence = readEvidence()
    if (!evidence.group_id || !evidence.dao_id) {
      throw new Error("Run the convert step first")
    }

    await page.goto(
      `/dao/${evidence.dao_id}/treasury?from=convert&groupId=${evidence.group_id}`,
      { waitUntil: "domcontentloaded" },
    )
    await expect(
      page.getByRole("heading", { level: 1, name: "升级成功" }),
    ).toBeVisible({ timeout: 60_000 })
    const balanceText = page.getByText(/^[\d.,]+ NEAR$/)
    await expect(balanceText.first()).toBeVisible({ timeout: 90_000 })

    const nativeBalance = await nearBalance(context.request, evidence.dao_id)
    const daoOwner = await viewCall<{ roles: unknown[] }>(
      context.request,
      evidence.dao_id,
      "get_policy",
    )
    expect(Array.isArray(daoOwner.roles)).toBe(true)

    const back = page.getByRole("link", { name: "回到聊天" }).first()
    await back.click()
    await expect(page).toHaveURL(
      new RegExp(`/groups/${evidence.group_id}/chat$`),
    )
    const backUrl = page.url()

    const finalEvidence = writeEvidence({
      ...evidence,
      treasury_native_balance: nativeBalance,
      back_to_chat: backUrl.endsWith(`/groups/${evidence.group_id}/chat`),
      back_url: backUrl,
      independent_reads: {
        ...(evidence.independent_reads ?? {}),
        group_owner: evidence.group_owner,
        member_is_member: true,
        dao_policy_roles: daoOwner.roles.length,
        treasury_native_balance: nativeBalance,
      },
    })

    // Hard failures: chain proof for create/join/message/convert is missing, or
    // the final URL is wrong. The indexer render is recorded separately because
    // :8787 is known to lag (RPC 422); its absence yields PARTIAL, not a fake
    // pass and not a discarded real journey.
    const reasons: string[] = []
    if (!finalEvidence.create_tx) reasons.push("missing create_tx")
    if (!finalEvidence.join_tx) reasons.push("missing join_tx")
    if (!finalEvidence.convert_tx) reasons.push("missing convert_tx")
    if (!finalEvidence.message_receipt_ids?.length) {
      reasons.push("missing message receipt ids")
    }
    if (!finalEvidence.dao_id) reasons.push("missing dao_id")
    if (!finalEvidence.message_on_chain) {
      reasons.push("chat message log missing from chain")
    }
    if (!finalEvidence.back_to_chat) reasons.push("back-to-chat URL mismatch")

    const reported = finalEvidence.indexed_message
      ? reasons
      : [...reasons, "indexer has not indexed the message yet (known :8787 lag)"]

    writeResult({
      status: reported.length === 0 ? "verified" : "partial",
      group_id: finalEvidence.group_id ?? null,
      dao_id: finalEvidence.dao_id ?? null,
      back_to_chat: Boolean(finalEvidence.back_to_chat),
      indexed_message: Boolean(finalEvidence.indexed_message),
      reasons: reported,
      created_at: new Date().toISOString(),
    })
    expect(reasons).toEqual([])
    expect(finalEvidence.back_to_chat).toBe(true)
    expect(finalEvidence.dao_id).toMatch(/\.sputnikv2\.testnet$/)
    // The render itself is reported, never asserted, while the indexer lags.
    expect(finalEvidence.message_on_chain).toBe(true)
  })
})
