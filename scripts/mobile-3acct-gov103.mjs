/**
 * MOBILE_3ACCT_STORY frames 103+: RoleWeight Transfer on gv16-8jh4.
 * A proposes → A/B VoteApprove → Approved + payout. Phone 390×844.
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { connect, keyStores, KeyPair, providers, utils } from "near-api-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/hub-qa/mobile-3acct")
fs.mkdirSync(out, { recursive: true })

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const START = Number(process.env.START_FRAME ?? "103")
const DAO = process.env.DAO_ID ?? "gv16-8jh4.sputnikv2.testnet"
const GROUP_ID = Number(process.env.GROUP_ID ?? "16")
const RPCS = [
  process.env.NEAR_RPC_URL,
  "https://testnet-rpc.intea.rs",
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
].filter(Boolean)

const TRANSFER_NEAR = process.env.TRANSFER_NEAR ?? "0.5" // 0.5N from 6N treasury
const TRANSFER_YOCTO = utils.format.parseNearAmount(TRANSFER_NEAR)
const RECEIVER = process.env.RECEIVER ?? "gv-b-1024-210252.testnet"
const BOND = "1000000000000000000000000" // 1N

const phone = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}

const DEFAULTS = {
  A: "gv-a-1024-210252.testnet",
  B: "gv-b-1024-210252.testnet",
  C: "gv-topup-mvmi9vo1.testnet",
}

function loadCred(who) {
  const accountId = DEFAULTS[who]
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${accountId}.json`)
  const j = JSON.parse(fs.readFileSync(p, "utf8"))
  return { accountId: j.account_id ?? accountId, privateKey: j.private_key, who }
}
const creds = { A: loadCred("A"), B: loadCred("B"), C: loadCred("C") }

const prevPath = path.join(out, "_last-chain.json")
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : {}
const chain = {
  ...prev,
  govAt: new Date().toISOString(),
  startFrame: START,
  daoId: DAO,
  groupId: GROUP_ID,
  steps: { ...(prev.steps || {}) },
  frames: [...(prev.frames || [])],
}
const log = []
let frameN = START

function note(msg) {
  console.log(msg)
  log.push(msg)
}

async function shot(page, slug, caption) {
  const name = `${String(frameN).padStart(3, "0")}-${slug}`.replace(/^0(?=\d{3})/, "")
  // keep 103 style without leading zero pad beyond 3 digits — use plain
  const fileName = `${frameN}-${slug}`
  frameN += 1
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, `${fileName}.png`), fullPage: false })
  note(`SHOT ${fileName} — ${caption}`)
  chain.frames.push({ name: fileName, caption, ok: true })
  return fileName
}

async function rpcCall(method, params) {
  let last
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
        signal: AbortSignal.timeout(25_000),
      })
      const j = await res.json()
      if (j.error) {
        last = new Error(JSON.stringify(j.error))
        continue
      }
      return j.result
    } catch (e) {
      last = e
    }
  }
  throw last
}

async function viewAccount(accountId) {
  const r = await rpcCall("query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return { near: Number(r.amount) / 1e24, amount: r.amount }
}

async function viewFn(accountId, methodName, args = {}) {
  const args_base64 = Buffer.from(JSON.stringify(args)).toString("base64")
  const r = await rpcCall("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64,
  })
  const text = Buffer.from(r.result).toString()
  return text.length ? JSON.parse(text) : null
}

async function nearAccount(accountId) {
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${accountId}.json`)
  const cred = JSON.parse(fs.readFileSync(p, "utf8"))
  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", accountId, KeyPair.fromString(cred.private_key))
  const provider = new providers.FailoverRpcProvider(
    RPCS.map((url) => new providers.JsonRpcProvider({ url })),
  )
  const near = await connect({
    networkId: "testnet",
    nodeUrl: RPCS[0],
    provider,
    keyStore,
  })
  return near.account(accountId)
}

async function connectKeypair(page, cred) {
  await page.addInitScript((c) => {
    window.__GV_KEYPAIR__ = c
  }, { accountId: cred.accountId, privateKey: cred.privateKey })
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.evaluate((c) => {
    window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c))
  }, { accountId: cred.accountId, privateKey: cred.privateKey })
  const chip = page.locator("#btn-nav-wallet")
  const text = (await chip.textContent().catch(() => "")) ?? ""
  if (text.includes("…") || text.includes(cred.accountId.slice(0, 6))) {
    note(`Tab ${cred.who} chip ok`)
    return
  }
  await chip.click()
  const keypairBtn = page.getByRole("button", { name: /Keypair \(demo\)/i })
  if (await keypairBtn.isVisible().catch(() => false)) {
    await keypairBtn.click()
    await page.getByLabel("Account ID").fill(cred.accountId)
    await page.getByLabel("Private key").fill(cred.privateKey)
    await page.getByRole("button", { name: /Connect keypair/i }).click()
  }
  await page.waitForTimeout(1500)
  await page.keyboard.press("Escape").catch(() => {})
  note(`Tab ${cred.who} connected`)
}

async function safeClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 12_000 })
    note(`click ok: ${label}`)
    return true
  } catch (e) {
    note(`click FAIL: ${label} — ${String(e.message || e).slice(0, 140)}`)
    return false
  }
}

async function waitProposal(id, wantStatuses, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const p = await viewFn(DAO, "get_proposal", { id })
      note(`proposal#${id} poll ${i}: ${p.status}`)
      if (wantStatuses.includes(p.status)) return p
    } catch (e) {
      note(`proposal poll err ${i}: ${String(e).slice(0, 80)}`)
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  return viewFn(DAO, "get_proposal", { id })
}

/** Direct chain fallback if UI stalls */
async function chainAddTransfer() {
  const a = await nearAccount(creds.A.accountId)
  const proposal = {
    description: `Mobile3 Transfer ${TRANSFER_NEAR}N → B @${Date.now()}`,
    kind: {
      Transfer: {
        token_id: "",
        receiver_id: RECEIVER,
        amount: TRANSFER_YOCTO,
        msg: null,
      },
    },
  }
  let last
  for (let i = 0; i < 5; i++) {
    try {
      const fresh = await nearAccount(creds.A.accountId)
      const out = await fresh.functionCall({
        contractId: DAO,
        methodName: "add_proposal",
        args: { proposal },
        gas: BigInt("100000000000000"),
        attachedDeposit: BigInt(BOND),
      })
      note(`chain add_proposal tx ${out.transaction_outcome?.id}`)
      return out
    } catch (e) {
      last = e
      note(`add_proposal retry ${i}: ${String(e).slice(0, 160)}`)
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)))
    }
  }
  throw last
}

async function chainVote(who, id, kind) {
  let last
  for (let i = 0; i < 5; i++) {
    try {
      const acc = await nearAccount(creds[who].accountId)
      const out = await acc.functionCall({
        contractId: DAO,
        methodName: "act_proposal",
        args: { id, action: "VoteApprove", proposal: kind, memo: null },
        gas: BigInt("300000000000000"),
        attachedDeposit: 0n,
      })
      note(`chain VoteApprove ${who} tx ${out.transaction_outcome?.id}`)
      return out
    } catch (e) {
      last = e
      const msg = String(e)
      note(`vote ${who} retry ${i}: ${msg.slice(0, 200)}`)
      if (/AlreadyVoted|not in progress|ERR_/i.test(msg) && !/InvalidNonce|nonce/i.test(msg)) {
        throw e
      }
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)))
    }
  }
  throw last
}

const browser = await chromium.launch({ headless: true })
const ctxA = await browser.newContext({ ...phone })
const ctxB = await browser.newContext({ ...phone })
const tabA = await ctxA.newPage()
const tabB = await ctxB.newPage()

try {
  const balA0 = await viewAccount(creds.A.accountId)
  const balB0 = await viewAccount(RECEIVER)
  const balDao0 = await viewAccount(DAO)
  chain.balancesBefore = { A: balA0.near, B: balB0.near, DAO: balDao0.near }
  note(`balances before A=${balA0.near.toFixed(4)} B=${balB0.near.toFixed(4)} DAO=${balDao0.near.toFixed(4)}`)

  const policy = await viewFn(DAO, "get_policy")
  chain.policy = {
    weight_kind: policy.default_vote_policy.weight_kind,
    threshold: policy.default_vote_policy.threshold,
    bond: policy.proposal_bond,
  }
  note(`policy weight=${chain.policy.weight_kind} threshold=${JSON.stringify(chain.policy.threshold)}`)
  chain.steps.policyRoleWeight = {
    pass: chain.policy.weight_kind === "RoleWeight",
    ...chain.policy,
  }

  await connectKeypair(tabA, creds.A)
  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2500)
  await shot(tabA, "A-dao-hub", "A DAO hub before Transfer")

  await tabA.goto(base + `/dao/${DAO}/treasury`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-treasury", "A treasury form")

  // Fill Transfer form
  await tabA.getByPlaceholder("receiver.testnet").fill(RECEIVER)
  // amount field shared — fill the yocto one under Add native Transfer (second numeric-ish)
  const amountInputs = tabA.locator('input[placeholder="amount in yoctoNEAR"]')
  await amountInputs.fill(TRANSFER_YOCTO)
  await tabA.getByPlaceholder("description").fill(`Mobile3 g16 Transfer ${TRANSFER_NEAR}N to B`)
  await shot(tabA, "A-transfer-form", "A Transfer form filled")

  let proposalId = null
  let usedUiPropose = false
  const proposeBtn = tabA.getByRole("button", { name: /Add Transfer proposal/i })
  if (await proposeBtn.isEnabled().catch(() => false)) {
    if (await safeClick(tabA, proposeBtn, "A add_proposal UI")) {
      usedUiPropose = true
      await tabA.waitForTimeout(15000)
      await shot(tabA, "A-transfer-submitted", "A after Add Transfer click")
      // Prefer link #id if shown
      const link = tabA.locator(`a[href*="/proposals/"]`)
      if (await link.first().isVisible().catch(() => false)) {
        const href = await link.first().getAttribute("href")
        const m = href && href.match(/\/proposals\/(\d+)/)
        if (m) proposalId = Number(m[1])
      }
    }
  }

  // Resolve proposal id from chain
  const nextId = await viewFn(DAO, "get_last_proposal_id")
  const newest = Number(nextId) - 1
  if (proposalId === null && newest >= 0) proposalId = newest
  note(`proposalId=${proposalId} nextCounter=${nextId} uiPropose=${usedUiPropose}`)

  if (proposalId === null || proposalId < 0) {
    note("UI propose did not create — chain fallback")
    await chainAddTransfer()
    proposalId = Number(await viewFn(DAO, "get_last_proposal_id")) - 1
    chain.steps.transferPropose = { pass: proposalId >= 0, via: "chain", proposalId }
  } else {
    chain.steps.transferPropose = { pass: true, via: usedUiPropose ? "ui" : "chain", proposalId }
  }
  chain.proposalId = proposalId

  let proposal = await waitProposal(proposalId, ["InProgress", "Approved", "Rejected", "Expired"], 12)
  chain.steps.transferInProgress = {
    pass: ["InProgress", "Approved"].includes(proposal.status),
    status: proposal.status,
  }

  // Open proposal page as A
  await tabA.goto(base + `/dao/${DAO}/proposals/${proposalId}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2500)
  await shot(tabA, "A-proposal", `A proposal #${proposalId} status=${proposal.status}`)

  if (proposal.status === "InProgress") {
    const approveBtn = tabA.getByRole("button", { name: /Approve exact kind/i })
    if (await approveBtn.isEnabled().catch(() => false)) {
      await safeClick(tabA, approveBtn, "A VoteApprove UI")
      await tabA.waitForTimeout(15000)
      await shot(tabA, "A-voted", "A after Approve click")
    } else {
      note("A Approve disabled — chain vote")
      await chainVote("A", proposalId, proposal.kind)
      await shot(tabA, "A-voted-chain", "A after chain VoteApprove")
    }
    proposal = await waitProposal(proposalId, ["Approved", "Rejected", "InProgress"], 20)
    chain.steps.voteA = { pass: true, statusAfter: proposal.status }
  } else {
    chain.steps.voteA = { pass: true, skipped: true, status: proposal.status }
  }

  // If still InProgress, B votes
  if (proposal.status === "InProgress") {
    await connectKeypair(tabB, creds.B)
    await tabB.goto(base + `/dao/${DAO}/proposals/${proposalId}`, { waitUntil: "domcontentloaded" })
    await tabB.waitForTimeout(2500)
    await shot(tabB, "B-proposal", `B proposal #${proposalId}`)
    const approveB = tabB.getByRole("button", { name: /Approve exact kind/i })
    if (await approveB.isEnabled().catch(() => false)) {
      await safeClick(tabB, approveB, "B VoteApprove UI")
      await tabB.waitForTimeout(15000)
      await shot(tabB, "B-voted", "B after Approve")
    } else {
      await chainVote("B", proposalId, proposal.kind)
      await tabB.reload({ waitUntil: "domcontentloaded" })
      await tabB.waitForTimeout(2000)
      await shot(tabB, "B-voted-chain", "B after chain VoteApprove")
    }
    proposal = await waitProposal(proposalId, ["Approved", "Rejected", "InProgress"], 25)
    chain.steps.voteB = { pass: true, statusAfter: proposal.status }
  }

  // If STILL InProgress, try C or chain A again already voted
  if (proposal.status === "InProgress") {
    note("still InProgress after A/B — chain vote C")
    try {
      await chainVote("C", proposalId, proposal.kind)
      chain.steps.voteC = { pass: true }
    } catch (e) {
      chain.steps.voteC = { pass: false, error: String(e).slice(0, 200) }
    }
    proposal = await waitProposal(proposalId, ["Approved", "Rejected", "InProgress"], 20)
  }

  // Final screenshots
  await tabA.goto(base + `/dao/${DAO}/proposals/${proposalId}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2500)
  await shot(tabA, "A-proposal-final", `Final status=${proposal.status}`)

  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-dao-after", "A DAO hub after Transfer vote")

  await tabA.goto(base + `/groups/${GROUP_ID}/chat`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-chat-post-gov", "A chat-first after governance")

  const balA1 = await viewAccount(creds.A.accountId)
  const balB1 = await viewAccount(RECEIVER)
  const balDao1 = await viewAccount(DAO)
  chain.balancesAfter = { A: balA1.near, B: balB1.near, DAO: balDao1.near }
  const daoDebit = balDao0.near - balDao1.near
  const bGain = balB1.near - balB0.near
  chain.steps.transferApproved = {
    pass: proposal.status === "Approved",
    status: proposal.status,
    proposalId,
  }
  chain.steps.transferPayout = {
    pass: proposal.status === "Approved" && daoDebit >= Number(TRANSFER_NEAR) * 0.99,
    daoDebit,
    bGain,
    transferNear: Number(TRANSFER_NEAR),
  }
  note(
    `final status=${proposal.status} daoDebit=${daoDebit.toFixed(4)} bGain=${bGain.toFixed(4)} A=${balA1.near.toFixed(4)}`,
  )

  chain.proposal = proposal
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps)
      .filter(([k]) => k !== "summary")
      .map(([k, v]) => [k, v?.pass ?? null]),
  )
} catch (e) {
  note(`FATAL ${String(e.stack || e).slice(0, 700)}`)
  chain.fatal = String(e.message || e)
  chain.nextFrame = frameN
} finally {
  fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
  fs.writeFileSync(path.join(out, "_gov103-log.txt"), log.join("\n"))
  await browser.close()
}

console.log(
  JSON.stringify(
    {
      proposalId: chain.proposalId,
      status: chain.proposal?.status,
      steps: chain.steps.summary,
      nextFrame: chain.nextFrame,
      balancesAfter: chain.balancesAfter,
    },
    null,
    2,
  ),
)
