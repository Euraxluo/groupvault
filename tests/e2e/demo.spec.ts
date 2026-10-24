import { expect, test, attachTransaction, envAccount, loadEvidence, saveEvidence } from "./fixtures"
import { connectMyNearWallet, waitForWalletApproval } from "./wallet"
import { expectDao, expectMember, viewCall } from "./evidence"

const CONTRACT = process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ?? ""
test.describe.configure({ mode: "serial" })

test("A creates a paid group", async ({ page, context }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  expect(CONTRACT).not.toBe("")
  await page.goto("/groups")
  await connectMyNearWallet(page)

  await page.getByRole("button", { name: /New/i }).click()
  await page.getByLabel("Name").fill("GroupVault Demo")
  await page.getByLabel("Join fee").fill("1000000")
  await page.getByRole("button", { name: /Create group/i }).click()
  await waitForWalletApproval(page, "create_group")

  await expect(page).toHaveURL(/\/groups\/\d+/, { timeout: 90_000 })
  const groupId = Number(page.url().split("/").pop())
  expect(Number.isSafeInteger(groupId)).toBeTruthy()

  const group = await viewCall<{ owner: string; dao_id: string | null }>(
    context.request,
    CONTRACT,
    "get_group",
    { group_id: groupId },
  )
  expect(group.owner).toBe(envAccount("A"))
  expect(group.dao_id).toBeNull()

  saveEvidence({
    ...loadEvidence(),
    network: "testnet",
    owner_account_id: envAccount("A"),
    member_account_id: envAccount("B"),
    join_ft_account_id: process.env.NEXT_PUBLIC_JOIN_FT ?? "",
    join_fee: "1000000",
    stake_amount: process.env.DEMO_STAKE_AMOUNT ?? "1000000",
    receiver_account_id: process.env.DEMO_RECEIVER ?? "",
    transfer_amount: process.env.DEMO_TRANSFER_AMOUNT ?? "1000000000000000000000000",
    group_id: groupId,
  })
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
  await page.goto(`/groups/${evidence.group_id}`)
  await connectMyNearWallet(page)
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
  await page.goto(`/groups/${evidence.group_id}/chat`)
  await connectMyNearWallet(page)
  await page.getByPlaceholder(/Write a public message/i).fill("Hello from account A")
  await page.getByRole("button", { name: /^Send$/i }).click()
  await waitForWalletApproval(page, "send_message")
  await expect(page.getByText("Hello from account A")).toBeVisible({ timeout: 60_000 })
})

test("A converts the group with one signature", async ({ page, context, evidence }) => {
  test.skip(
    process.env.DEMO_PHASE !== "through-convert",
    "set DEMO_PHASE=through-convert to run the browser journey",
  )
  if (!evidence?.group_id) {
    throw new Error("Run the create step first; demo-input.json has no group_id")
  }
  await page.goto(`/groups/${evidence.group_id}/convert`)
  await connectMyNearWallet(page)
  await page.getByRole("button", { name: /Convert with wallet/i }).click()
  await waitForWalletApproval(page, "convert_to_dao")

  const daoId = await expectDao(
    context.request,
    CONTRACT,
    evidence.group_id as number,
  )
  await expect(page.getByText(daoId)).toBeVisible({ timeout: 90_000 })
  saveEvidence({ ...loadEvidence(), dao_id: daoId })
})

