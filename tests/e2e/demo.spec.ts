import {
  expect,
  test,
  attachTransaction,
  envAccount,
  lastReceiptIdsFor,
  lastTxFor,
  loadEvidence,
  recordSentTransactions,
  resetEvidence,
  saveEvidence,
} from "./fixtures"
import { connectWalletForDemo, waitForWalletApproval } from "./wallet"
import { expectDao, expectMember, viewCall } from "./evidence"

const CONTRACT = process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ?? ""
test.describe.configure({ mode: "serial" })

/** Give the response handler a moment to record the confirmed tx. */
async function recordedTx(
  page: import("@playwright/test").Page,
  sent: Parameters<typeof lastTxFor>[0],
  signerId: string,
  methodName: string,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const hash = lastTxFor(sent, signerId, methodName)
    if (hash) return hash
    await page.waitForTimeout(500)
  }
  throw new Error(`No confirmed ${methodName} send_tx observed for ${signerId}`)
}

test("A creates a paid group", async ({ page, context }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  expect(CONTRACT).not.toBe("")
  const sent = recordSentTransactions(page)
  await page.goto("/groups")
  await connectWalletForDemo(page, "A")

  await page.getByRole("button", { name: /New/i }).click()
  await page.getByLabel("Name").fill("GroupVault Demo")
  await page.getByLabel("Join fee").fill("1000000")
  await page.getByRole("button", { name: /Create group/i }).click()
  await waitForWalletApproval(page, "create_group")

  await expect(page).toHaveURL(/\/groups\/\d+/, { timeout: 90_000 })
  const groupId = Number(page.url().split("/").pop())
  expect(Number.isSafeInteger(groupId)).toBeTruthy()
  const createTx = await recordedTx(page, sent, envAccount("A"), "create_group")

  // Start from a clean record: never inherit a previous run's dao_id/tx.
  // Persist before RPC assertions so a flaky viewCall cannot erase a real
  // on-chain create.
  resetEvidence({
    network: "testnet",
    owner_account_id: envAccount("A"),
    member_account_id: envAccount("B"),
    join_ft_account_id: process.env.NEXT_PUBLIC_JOIN_FT ?? "",
    join_fee: "1000000",
    stake_amount: process.env.DEMO_STAKE_AMOUNT ?? "1000000",
    receiver_account_id: process.env.DEMO_RECEIVER ?? "",
    transfer_amount: process.env.DEMO_TRANSFER_AMOUNT ?? "1000000000000000000000000",
    group_id: groupId,
    create_tx: createTx,
  })

  const group = await viewCall<{ owner: string; dao_id: string | null }>(
    context.request,
    CONTRACT,
    "get_group",
    { group_id: groupId },
  )
  expect(group.owner).toBe(envAccount("A"))
  expect(group.dao_id).toBeNull()
  await attachTransaction(page, `group:${groupId}`)
})

test("B pays the join fee with the exact FT", async ({ page, context, evidence }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  if (!evidence?.group_id) {
    throw new Error("Run the create step first; demo-input.json has no group_id")
  }
  const sent = recordSentTransactions(page)
  await page.goto(`/groups/${evidence.group_id}`)
  await connectWalletForDemo(page, "B")
  await page.getByRole("button", { name: /Pay and join/i }).click()
  await waitForWalletApproval(page, "ft_transfer_call join")

  await expect
    .poll(
      async () =>
        viewCall<boolean>(context.request, CONTRACT, "is_member", {
          group_id: evidence.group_id,
          account_id: evidence.member_account_id,
        }),
      { timeout: 90_000 },
    )
    .toBe(true)
  const joinTx = await recordedTx(page, sent, evidence.member_account_id, "ft_transfer_call")
  saveEvidence({ ...loadEvidence(), join_tx: joinTx })
  await expectMember(
    context.request,
    CONTRACT,
    evidence.group_id as number,
    evidence.member_account_id,
  )
})

test("A and B exchange public chat messages", async ({ page, evidence }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  if (!evidence?.group_id) {
    throw new Error("Run the create step first; demo-input.json has no group_id")
  }
  const sent = recordSentTransactions(page)
  await page.goto(`/groups/${evidence.group_id}/chat`)
  await connectWalletForDemo(page, "A")
  const messageText = `Hello from account A ${Date.now()}`
  await page.getByPlaceholder(/Write a public message/i).fill(messageText)
  await page.getByRole("button", { name: /^Send$/i }).click()
  await waitForWalletApproval(page, "send_message")
  // The textarea still holds the text, so asserting page text would pass even
  // when the indexer never saw the message. Assert the rendered message element
  // inside the message card plus the indexer API itself.
  // `<p>` is the rendered message body; the textarea is a separate control.
  const renderedMessage = page.locator("p").filter({ hasText: messageText })
  await expect(renderedMessage).toBeVisible({
    timeout: 90_000,
  })
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `http://127.0.0.1:8787/messages?group_id=${evidence.group_id}`,
        )
        if (!response.ok()) return false
        const body = (await response.json()) as {
          items?: { text?: string; sender?: string; receipt_id?: string }[]
        }
        return (body.items ?? []).some(
          (item) =>
            item.text === messageText &&
            item.sender === evidence.owner_account_id &&
            typeof item.receipt_id === "string" &&
            item.receipt_id.length > 0,
        )
      },
      { timeout: 120_000 },
    )
    .toBe(true)
  await recordedTx(page, sent, evidence.owner_account_id, "send_message")
  const messageReceipts = lastReceiptIdsFor(
    sent,
    evidence.owner_account_id,
    "send_message",
  )
  saveEvidence({
    ...loadEvidence(),
    message_receipt_ids: messageReceipts,
  })
})

test("A converts the group with one signature", async ({ page, context, evidence }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  if (!evidence?.group_id) {
    throw new Error("Run the create step first; demo-input.json has no group_id")
  }
  const sent = recordSentTransactions(page)
  await page.goto(`/groups/${evidence.group_id}/convert`)
  await connectWalletForDemo(page, "A")
  const convertBtn = page.getByRole("button", { name: /Convert with wallet/i })
  await expect(convertBtn).toBeEnabled({ timeout: 30_000 })
  await convertBtn.click()
  await waitForWalletApproval(page, "convert_to_dao")
  const convertTx = await recordedTx(page, sent, evidence.owner_account_id, "convert_to_dao")
  saveEvidence({ ...loadEvidence(), convert_tx: convertTx })
  // Factory callback can lag a few blocks after the owner signature.
  await expect.poll(async () => {
    const body = (await page.textContent("body")) ?? ""
    return /\.sputnikv2\.testnet|Convert complete|Open DAO/i.test(body)
  }, { timeout: 120_000 }).toBe(true)

  const daoId = await expectDao(
    context.request,
    CONTRACT,
    evidence.group_id as number,
  )
  await expect(page.getByText(daoId)).toBeVisible({ timeout: 90_000 })
  saveEvidence({ ...loadEvidence(), dao_id: daoId })
})

