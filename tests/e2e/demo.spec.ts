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
import { expectDao, expectMember, nearBalance, viewCall } from "./evidence"

const CONTRACT = process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ?? ""
test.describe.configure({ mode: "serial" })

const GOVERNANCE = "governance"

/** Governance steps run only in the second phase, after Convert is on chain. */
function skipUnlessGovernance(): void {
  test.skip(
    process.env.DEMO_PHASE !== GOVERNANCE,
    "set DEMO_PHASE=governance to run the TokenWeight/Transfer phase",
  )
}

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

/**
 * T013 governance phase, run against the group/DAO already recorded in
 * artifacts/demo-input.json (Convert complete).
 *
 * Under the default RoleWeight policy the council has two members and the
 * threshold is [1, 2], so Sputnik requires both approvals (ratio 1/2 of a
 * 2-vote total plus one). The person who proposes is also a voter, so the
 * proposal proposal -> A approve -> B approve sequence executes it.
 *
 * Once the policy becomes TokenWeight, weight comes from delegated stake, so
 * B (who staked nothing) must be rejected locally before a wallet call.
 */
test.describe("governance", () => {
  test("A proposes and both approve SetStakingContract", async ({ page, context, evidence }) => {
    skipUnlessGovernance()
    const staking = process.env.DEMO_STAKING_CONTRACT ?? ""
    if (!evidence?.dao_id) throw new Error("Convert must be complete before governance")
    if (!staking) throw new Error("DEMO_STAKING_CONTRACT is required")
    expect(staking).toMatch(/\.testnet$/)

    // Already on chain from an earlier partial run: nothing to redo.
    const current = await viewCall<string | null>(
      context.request,
      evidence.dao_id,
      "get_staking_contract",
    )
    if (current === staking) {
      saveEvidence({ ...loadEvidence(), staking_contract_id: staking })
      return
    }

    const sent = recordSentTransactions(page)
    await page.goto(`/dao/${evidence.dao_id}/staking/setup`)
    await connectWalletForDemo(page, "A")
    // Resume a pending SetStakingContract proposal instead of paying another
    // bond when an earlier attempt already created one.
    const nextId = await viewCall<number>(
      context.request,
      evidence.dao_id,
      "get_last_proposal_id",
    )
    let proposalId = nextId - 1
    let proposalTx = evidence.set_staking_tx ?? ""
    const pending = proposalId >= 0
      ? await viewCall<{ kind: Record<string, unknown>; status: string }>(
          context.request,
          evidence.dao_id,
          "get_proposal",
          { id: proposalId },
        ).catch(() => null)
      : null
    const alreadyProposed =
      pending?.status === "InProgress" &&
      JSON.stringify(pending.kind).includes(staking)

    if (!alreadyProposed) {
      await page.getByPlaceholder("staking account ID").fill(staking)
      await page.getByRole("button", { name: /Add SetStakingContract proposal/i }).click()
      await waitForWalletApproval(page, "add_proposal SetStakingContract")
      proposalTx = await recordedTx(page, sent, evidence.owner_account_id, "add_proposal")
      proposalId = (await viewCall<number>(
        context.request,
        evidence.dao_id,
        "get_last_proposal_id",
      )) - 1
    }

    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await waitForWalletApproval(page, "act_proposal A")

    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await connectWalletForDemo(page, "B")
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await waitForWalletApproval(page, "act_proposal B")

    await expect
      .poll(
        async () =>
          viewCall<string | null>(context.request, evidence.dao_id!, "get_staking_contract"),
        { timeout: 180_000 },
      )
      .toBe(staking)

    saveEvidence({
      ...loadEvidence(),
      staking_contract_id: staking,
      set_staking_tx: proposalTx,
      set_staking_proposal_id: proposalId,
    })
  })

  test("two approvals switch the DAO policy to TokenWeight", async ({ page, context, evidence }) => {
    skipUnlessGovernance()
    if (!evidence?.dao_id) throw new Error("Convert must be complete before governance")

    const alreadyTokenWeight = async () =>
      (
        await viewCall<{ default_vote_policy: { weight_kind: string } }>(
          context.request,
          evidence.dao_id!,
          "get_policy",
        )
      ).default_vote_policy.weight_kind === "TokenWeight"
    if (await alreadyTokenWeight()) {
      saveEvidence({ ...loadEvidence(), tokenweight_policy_tx: "already-applied" })
      return
    }

    const sent = recordSentTransactions(page)
    await page.goto(`/dao/${evidence.dao_id}/staking/setup`)
    await connectWalletForDemo(page, "A")
    await page.getByRole("button", { name: /Add TokenWeight policy proposal/i }).click()
    await waitForWalletApproval(page, "add_proposal TokenWeight")
    const policyTx = await recordedTx(page, sent, evidence.owner_account_id, "add_proposal")

    // `get_last_proposal_id` is the next counter, so the newest existing id is
    // that value minus one.
    const proposalId =
      (await viewCall<number>(context.request, evidence.dao_id, "get_last_proposal_id")) - 1
    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await waitForWalletApproval(page, "act_proposal A")

    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await connectWalletForDemo(page, "B")
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await waitForWalletApproval(page, "act_proposal B")

    await expect
      .poll(
        async () =>
          (
            await viewCall<{ default_vote_policy: { weight_kind: string } }>(
              context.request,
              evidence.dao_id!,
              "get_policy",
            )
          ).default_vote_policy.weight_kind,
        { timeout: 180_000 },
      )
      .toBe("TokenWeight")

    saveEvidence({
      ...loadEvidence(),
      tokenweight_policy_tx: policyTx,
      tokenweight_proposal_id: proposalId,
    })
  })

  test("A stakes the join FT and delegates, proving stake is the only weight", async ({
    page,
    context,
    evidence,
  }) => {
    skipUnlessGovernance()
    const stakeAmount = process.env.DEMO_STAKE_AMOUNT ?? "1000000"
    if (!evidence?.dao_id || !evidence.staking_contract_id) {
      throw new Error("Staking setup must run before staking")
    }
    const payload = { account_id: evidence.owner_account_id }
    const weightBefore = BigInt(
      await viewCall<string>(context.request, evidence.dao_id, "delegation_balance_of", payload),
    )
    // Resuming after a partial run: stake already delegated, so there is
    // nothing to repeat. Weight must stay positive, not grow again.
    if (weightBefore > 0n) {
      saveEvidence({
        ...loadEvidence(),
        delegation_before: loadEvidence().delegation_before ?? "0",
        delegation: weightBefore.toString(),
        stake_tx: loadEvidence().stake_tx ?? "already-delegated",
        delegate_tx: loadEvidence().delegate_tx ?? "already-delegated",
      })
      return
    }

    const sent = recordSentTransactions(page)
    await page.goto(`/dao/${evidence.dao_id}/staking/setup`)
    await connectWalletForDemo(page, "A")
    await page.getByLabel("Stake amount (base units)").fill(stakeAmount)

    await page.getByRole("button", { name: /^Storage deposit$/i }).click()
    await waitForWalletApproval(page, "storage_deposit")
    await page.getByRole("button", { name: /FT transfer/i }).click()
    await waitForWalletApproval(page, "ft_transfer_call stake")
    await page.getByRole("button", { name: /^Delegate$/i }).click()
    await waitForWalletApproval(page, "delegate")

    await expect
      .poll(
        async () =>
          BigInt(
            await viewCall<string>(
              context.request,
              evidence.dao_id!,
              "delegation_balance_of",
              payload,
            ),
          ),
        { timeout: 120_000 },
      )
      .toBeGreaterThan(weightBefore)

    saveEvidence({
      ...loadEvidence(),
      delegation_before: String(weightBefore),
      delegation: String(
        await viewCall<string>(context.request, evidence.dao_id, "delegation_balance_of", payload),
      ),
      stake_tx: lastTxFor(sent, evidence.owner_account_id, "ft_transfer_call"),
      delegate_tx: lastTxFor(sent, evidence.owner_account_id, "delegate"),
    })
  })

  test("B is rejected as a zero-weight voter", async ({ page, context, evidence }) => {
    skipUnlessGovernance()
    if (!evidence?.dao_id) throw new Error("Governance evidence is incomplete")

    const sent = recordSentTransactions(page)
    const amount = process.env.DEMO_TRANSFER_AMOUNT ?? "1000000000000000000000000"
    const receiver = evidence.receiver_account_id
    const latestId =
      (await viewCall<number>(context.request, evidence.dao_id, "get_last_proposal_id")) - 1
    const existing = latestId >= 0
      ? await viewCall<{ kind: Record<string, unknown>; status: string }>(
          context.request,
          evidence.dao_id,
          "get_proposal",
          { id: latestId },
        ).catch(() => null)
      : null
    // A pending Transfer to the same receiver from an earlier attempt can be
    // reused; re-proposing would spend another 1 NEAR bond.
    if (
      existing?.status === "InProgress" &&
      JSON.stringify(existing.kind).includes(receiver)
    ) {
      await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${latestId}`)
      await connectWalletForDemo(page, "B")
      await page.getByRole("button", { name: /Approve exact kind/i }).click()
      await expect(page.getByText(/Zero voting weight/i)).toBeVisible({ timeout: 60_000 })
      const after = await viewCall<{ status: string }>(
        context.request,
        evidence.dao_id,
        "get_proposal",
        { id: latestId },
      )
      expect(after.status).toBe("InProgress")
      saveEvidence({
        ...loadEvidence(),
        proposal_id: latestId,
        zero_weight_rejected: true,
        proposal_status_after_rejection: after.status,
      })
      return
    }

    await page.goto(`/dao/${evidence.dao_id}/treasury`)
    await connectWalletForDemo(page, "A")

    // Only fund when the DAO cannot already cover the transfer (a resumed run
    // must not require another 1 NEAR from A).
    const daoAmount = BigInt(
      await viewCall<{ amount: string }>(context.request, evidence.dao_id, "get_staking_contract")
        .then(() => nearBalance(context.request, evidence.dao_id!))
        .catch(() => "0"),
    )
    let fundTx = evidence.dao_fund_tx ?? ""
    if (daoAmount < BigInt(amount)) {
      await page.getByLabel("Fund amount (yoctoNEAR)").fill(amount)
      await page.getByRole("button", { name: /Fund DAO from wallet/i }).click()
      await waitForWalletApproval(page, "fund DAO")
      fundTx = await recordedTx(page, sent, evidence.owner_account_id, "Transfer")
    }

    await page.getByPlaceholder("receiver.testnet").fill(receiver)
    await page.getByPlaceholder("amount in yoctoNEAR").fill(amount)
    await page.getByPlaceholder("description").fill("T013 transfer")
    await page.getByRole("button", { name: /Add Transfer proposal/i }).click()
    await waitForWalletApproval(page, "add_proposal Transfer")
    const proposalTx = await recordedTx(page, sent, evidence.owner_account_id, "add_proposal")

    // `get_last_proposal_id` is the next counter, so the newest existing id is
    // that value minus one.
    const proposalId =
      (await viewCall<number>(context.request, evidence.dao_id, "get_last_proposal_id")) - 1
    const before = await viewCall<{ status: string }>(
      context.request,
      evidence.dao_id,
      "get_proposal",
      { id: proposalId },
    )

    // B has no stake, so the gate must reject before any wallet approval.
    // Connect first: navigating after a demo-keypair connect can reset the
    // in-memory session and silently fall back to A, which would approve.
    await connectWalletForDemo(page, "B")
    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await expect(page.getByText(/Zero voting weight/i)).toBeVisible({ timeout: 60_000 })

    const after = await viewCall<{ status: string }>(
      context.request,
      evidence.dao_id,
      "get_proposal",
      { id: proposalId },
    )
    expect(after.status).toBe(before.status)

    saveEvidence({
      ...loadEvidence(),
      dao_fund_tx: fundTx,
      transfer_proposal_tx: proposalTx,
      proposal_id: proposalId,
      proposal_status_before_approve: before.status,
      zero_weight_rejected: true,
      proposal_status_after_rejection: after.status,
      receiver_balance_before: await nearBalance(context.request, receiver),
    })
  })

  test("A's stake executes the Transfer and the receiver balance increases", async ({
    page,
    context,
    evidence,
  }) => {
    skipUnlessGovernance()
    const receiver = evidence?.receiver_account_id
    if (!evidence?.dao_id || evidence.proposal_id === undefined || !receiver) {
      throw new Error("The Transfer proposal must exist before approving it")
    }
    const proposalId = evidence.proposal_id
    const before = await nearBalance(context.request, receiver)

    const sent = recordSentTransactions(page)
    await page.goto(`/dao/${evidence.dao_id}/proposals?ids=${proposalId}`)
    await connectWalletForDemo(page, "A")
    await page.getByRole("button", { name: /Approve exact kind/i }).click()
    await waitForWalletApproval(page, "act_proposal VoteApprove")
    const approveTx = await recordedTx(page, sent, evidence.owner_account_id, "act_proposal")

    await expect
      .poll(
        async () =>
          (
            await viewCall<{ status: string }>(context.request, evidence.dao_id!, "get_proposal", {
              id: proposalId,
            })
          ).status,
        { timeout: 180_000 },
      )
      .toBe("Approved")

    await expect
      .poll(async () => BigInt(await nearBalance(context.request, receiver)), {
        timeout: 180_000,
      })
      .toBeGreaterThan(BigInt(before))

    saveEvidence({
      ...loadEvidence(),
      transfer_approve_tx: approveTx,
      proposal_status_after_approve: "Approved",
      receiver_balance_after: await nearBalance(context.request, receiver),
    })
  })
})
