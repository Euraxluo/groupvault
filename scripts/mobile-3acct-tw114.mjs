/**
 * Frames 114+: TokenWeight beat for gv16-8jh4.
 * Shared sputnikstaking is owned by groupvault-13 — deploy staking.gv-a-... owned by gv16.
 * Flow: RoleWeight fund A → deploy staking → SetStaking → TokenWeight → stake → Transfer + zero-weight reject.
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
const wasmPath = path.join(root, "artifacts/wasm/sputnik_staking.wasm")
const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const START = Number(process.env.START_FRAME ?? "114")
const DAO = "gv16-8jh4.sputnikv2.testnet"
const FT = "gv-deployer-1024-204559-ft.testnet"
const STAKING = process.env.STAKING_ID ?? "staking.gv-a-1024-210252.testnet"
const FUND_NEAR = process.env.FUND_NEAR ?? "3.2"
const TRANSFER2_NEAR = process.env.TRANSFER2_NEAR ?? "0.2"
const STAKE_AMOUNT = process.env.STAKE_AMOUNT ?? "2000000" // FT base units
const BOND = "1000000000000000000000000"
const RPCS = [
  process.env.NEAR_RPC_URL,
  "https://testnet-rpc.intea.rs",
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
].filter(Boolean)

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
  twAt: new Date().toISOString(),
  startFrame: START,
  daoId: DAO,
  stakingId: STAKING,
  steps: { ...(prev.steps || {}) },
  frames: [...(prev.frames || [])],
  proposals: { ...(prev.proposals || {}) },
}
const log = []
let frameN = START
function note(msg) {
  console.log(msg)
  log.push(msg)
}

async function shot(page, slug, caption) {
  const fileName = `${frameN}-${slug}`
  frameN += 1
  await page.waitForTimeout(450)
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
        signal: AbortSignal.timeout(30_000),
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
  try {
    const r = await rpcCall("query", {
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    return { near: Number(r.amount) / 1e24, amount: r.amount, code: r.code_hash }
  } catch (e) {
    return null
  }
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
  const near = await connect({ networkId: "testnet", nodeUrl: RPCS[0], provider, keyStore })
  return { near, account: await near.account(accountId), keyStore, privateKey: cred.private_key }
}

async function withRetry(label, fn, tries = 5) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      note(`${label} retry ${i}: ${String(e).slice(0, 180)}`)
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw last
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
  await page.waitForTimeout(1200)
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

async function newestProposalId() {
  return Number(await viewFn(DAO, "get_last_proposal_id")) - 1
}

async function waitProposal(id, want, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const p = await viewFn(DAO, "get_proposal", { id })
      note(`#${id} ${p.status} (want ${want.join("|")})`)
      if (want.includes(p.status)) return p
    } catch (e) {
      note(`#${id} poll err ${String(e).slice(0, 80)}`)
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  return viewFn(DAO, "get_proposal", { id })
}

async function chainAddProposal(description, kind) {
  return withRetry(`add_proposal ${description.slice(0, 40)}`, async () => {
    const { account } = await nearAccount(creds.A.accountId)
    const out = await account.functionCall({
      contractId: DAO,
      methodName: "add_proposal",
      args: { proposal: { description, kind } },
      gas: BigInt("100000000000000"),
      attachedDeposit: BigInt(BOND),
    })
    note(`add_proposal tx ${out.transaction_outcome?.id}`)
    return out
  })
}

async function chainVote(who, id, kind) {
  return withRetry(`vote ${who} #${id}`, async () => {
    const { account } = await nearAccount(creds[who].accountId)
    const out = await account.functionCall({
      contractId: DAO,
      methodName: "act_proposal",
      args: { id, action: "VoteApprove", proposal: kind, memo: null },
      gas: BigInt("300000000000000"),
      attachedDeposit: 0n,
    })
    note(`VoteApprove ${who} tx ${out.transaction_outcome?.id}`)
    return out
  })
}

async function approveProposalAB(pageA, pageB, proposalId, label) {
  let p = await waitProposal(proposalId, ["InProgress", "Approved"], 15)
  await pageA.goto(base + `/dao/${DAO}/proposals/${proposalId}`, { waitUntil: "domcontentloaded" })
  await pageA.waitForTimeout(2000)
  await shot(pageA, `A-${label}-proposal`, `A #${proposalId} ${p.status}`)
  if (p.status === "InProgress") {
    const btn = pageA.getByRole("button", { name: /Approve exact kind/i })
    if (await btn.isEnabled().catch(() => false)) {
      await safeClick(pageA, btn, `A approve ${label}`)
      await pageA.waitForTimeout(12000)
    } else {
      await chainVote("A", proposalId, p.kind)
    }
    await shot(pageA, `A-${label}-voted`, `A voted ${label}`)
    p = await waitProposal(proposalId, ["Approved", "InProgress"], 20)
  }
  if (p.status === "InProgress") {
    await connectKeypair(pageB, creds.B)
    await pageB.goto(base + `/dao/${DAO}/proposals/${proposalId}`, { waitUntil: "domcontentloaded" })
    await pageB.waitForTimeout(2000)
    await shot(pageB, `B-${label}-proposal`, `B #${proposalId}`)
    const btn = pageB.getByRole("button", { name: /Approve exact kind/i })
    if (await btn.isEnabled().catch(() => false)) {
      await safeClick(pageB, btn, `B approve ${label}`)
      await pageB.waitForTimeout(12000)
    } else {
      await chainVote("B", proposalId, p.kind)
    }
    await shot(pageB, `B-${label}-voted`, `B voted ${label}`)
    p = await waitProposal(proposalId, ["Approved", "InProgress", "Rejected"], 25)
  }
  chain.proposals[label] = { id: proposalId, status: p.status }
  return p
}

async function deployStaking() {
  const existing = await viewAccount(STAKING)
  if (existing && existing.code !== "11111111111111111111111111111111") {
    note(`staking already deployed ${STAKING} near=${existing.near}`)
    // verify owner via view_state
    chain.steps.deployStaking = { pass: true, reused: true, stakingId: STAKING }
    return
  }
  if (!fs.existsSync(wasmPath)) throw new Error(`missing wasm ${wasmPath}`)
  const wasm = fs.readFileSync(wasmPath)
  const keyPair = KeyPair.fromRandom("ed25519")
  const publicKey = keyPair.getPublicKey().toString()
  const fundYocto = BigInt(utils.format.parseNearAmount("2.6"))

  await withRetry("createAccount staking", async () => {
    const { account } = await nearAccount(creds.A.accountId)
    if (!existing) {
      const out = await account.createAccount(STAKING, publicKey, fundYocto)
      note(`createAccount tx ${out.transaction_outcome?.id}`)
    }
  })

  // persist credential
  const credDir = path.join(os.homedir(), ".near-credentials/testnet")
  fs.writeFileSync(
    path.join(credDir, `${STAKING}.json`),
    JSON.stringify({ account_id: STAKING, public_key: publicKey, private_key: keyPair.toString() }, null, 2),
    { mode: 0o600 },
  )

  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", STAKING, keyPair)
  // also keep A's key for nothing
  const provider = new providers.FailoverRpcProvider(
    RPCS.map((url) => new providers.JsonRpcProvider({ url })),
  )

  await withRetry("deployContract", async () => {
    const near = await connect({ networkId: "testnet", nodeUrl: RPCS[0], provider, keyStore })
    const child = await near.account(STAKING)
    const out = await child.deployContract(wasm)
    note(`deploy tx ${out.transaction_outcome?.id}`)
  })

  await withRetry("init staking", async () => {
    const near = await connect({ networkId: "testnet", nodeUrl: RPCS[0], provider, keyStore })
    const child = await near.account(STAKING)
    const out = await child.functionCall({
      contractId: STAKING,
      methodName: "new",
      args: {
        owner_id: DAO,
        token_id: FT,
        unstake_period: "604800000000000",
      },
      gas: BigInt("100000000000000"),
      attachedDeposit: 0n,
    })
    note(`init tx ${out.transaction_outcome?.id}`)
  })

  chain.steps.deployStaking = { pass: true, reused: false, stakingId: STAKING }
}

const browser = await chromium.launch({ headless: true })
const ctxA = await browser.newContext({ ...phone })
const ctxB = await browser.newContext({ ...phone })
const tabA = await ctxA.newPage()
const tabB = await ctxB.newPage()

try {
  const balA0 = await viewAccount(creds.A.accountId)
  const balDao0 = await viewAccount(DAO)
  chain.balancesBefore = { A: balA0?.near, DAO: balDao0?.near, B: (await viewAccount(creds.B.accountId))?.near }
  note(`before A=${balA0?.near} DAO=${balDao0?.near}`)

  await connectKeypair(tabA, creds.A)
  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-dao-start", "A DAO hub start TokenWeight beat")

  // --- 1) Fund A from DAO via RoleWeight Transfer (if A < 4N) ---
  if ((balA0?.near ?? 0) < 4.0) {
    const fundYocto = utils.format.parseNearAmount(FUND_NEAR)
    note(`Funding A with ${FUND_NEAR}N from DAO treasury`)
    await tabA.goto(base + `/dao/${DAO}/treasury`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(1500)
    await shot(tabA, "A-fund-treasury", "A treasury before fund-self Transfer")
    await chainAddProposal(`Fund A ${FUND_NEAR}N for gv16 staking deploy`, {
      Transfer: { token_id: "", receiver_id: creds.A.accountId, amount: fundYocto, msg: null },
    })
    const fundId = await newestProposalId()
    chain.proposals.fundA = { id: fundId }
    const funded = await approveProposalAB(tabA, tabB, fundId, "fund")
    chain.steps.fundA = { pass: funded.status === "Approved", status: funded.status, near: FUND_NEAR }
  } else {
    chain.steps.fundA = { pass: true, skipped: true, near: balA0.near }
  }
  note(`A after fund ${(await viewAccount(creds.A.accountId))?.near}`)

  // --- 2) Deploy staking owned by gv16 ---
  await deployStaking()
  const stState = await viewAccount(STAKING)
  note(`staking ${STAKING} near=${stState?.near} code=${stState?.code?.slice(0, 12)}`)

  // --- 3) SetStakingContract (still RoleWeight) ---
  let stakingOnDao = await viewFn(DAO, "get_staking_contract")
  if (stakingOnDao !== STAKING) {
    await tabA.goto(base + `/dao/${DAO}/staking/setup`, { waitUntil: "domcontentloaded" }).catch(async () => {
      await tabA.goto(base + `/dao/${DAO}/stake`, { waitUntil: "domcontentloaded" })
    })
    // try setup route
    const setupUrl = base + `/dao/${DAO}/staking/setup`
    await tabA.goto(setupUrl, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    await shot(tabA, "A-staking-setup", "A staking setup page")
    const stakeInput = tabA.getByPlaceholder("staking account ID")
    if (await stakeInput.isVisible().catch(() => false)) {
      await stakeInput.fill(STAKING)
      await shot(tabA, "A-setstaking-form", "A SetStaking form filled")
      if (await safeClick(tabA, tabA.getByRole("button", { name: /Add SetStakingContract proposal/i }), "UI SetStaking")) {
        await tabA.waitForTimeout(12000)
      } else {
        await chainAddProposal("Set GroupVault staking contract", {
          SetStakingContract: { staking_id: STAKING },
        })
      }
    } else {
      await chainAddProposal("Set GroupVault staking contract", {
        SetStakingContract: { staking_id: STAKING },
      })
    }
    const setId = await newestProposalId()
    const setP = await approveProposalAB(tabA, tabB, setId, "setstaking")
    stakingOnDao = await viewFn(DAO, "get_staking_contract")
    chain.steps.setStaking = {
      pass: setP.status === "Approved" && stakingOnDao === STAKING,
      status: setP.status,
      stakingOnDao,
    }
  } else {
    chain.steps.setStaking = { pass: true, skipped: true, stakingOnDao }
  }
  note(`get_staking_contract=${stakingOnDao}`)

  // --- 4) TokenWeight policy ---
  let policy = await viewFn(DAO, "get_policy")
  if (policy.default_vote_policy.weight_kind !== "TokenWeight") {
    await tabA.goto(base + `/dao/${DAO}/staking/setup`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    await shot(tabA, "A-tokenweight-setup", "A before TokenWeight proposal")
    const twBtn = tabA.getByRole("button", { name: /Add TokenWeight policy proposal/i })
    if (await twBtn.isEnabled().catch(() => false)) {
      await safeClick(tabA, twBtn, "UI TokenWeight")
      await tabA.waitForTimeout(12000)
    } else {
      await chainAddProposal("Change policy to TokenWeight", {
        ChangePolicyUpdateDefaultVotePolicy: {
          vote_policy: { weight_kind: "TokenWeight", quorum: "0", threshold: [1, 2] },
        },
      })
    }
    const twId = await newestProposalId()
    // Still RoleWeight for this vote
    const twP = await approveProposalAB(tabA, tabB, twId, "tokenweight")
    policy = await viewFn(DAO, "get_policy")
    chain.steps.tokenWeight = {
      pass: twP.status === "Approved" && policy.default_vote_policy.weight_kind === "TokenWeight",
      status: twP.status,
      weight: policy.default_vote_policy.weight_kind,
    }
  } else {
    chain.steps.tokenWeight = { pass: true, skipped: true }
  }
  note(`policy weight=${policy.default_vote_policy.weight_kind}`)

  // --- 5) Stake as A: storage_deposit + ft_transfer_call + delegate ---
  let delegation = "0"
  try {
    delegation = String(await viewFn(DAO, "delegation_balance_of", { account_id: creds.A.accountId }))
  } catch {}
  if (BigInt(delegation || "0") <= 0n) {
    await tabA.goto(base + `/dao/${DAO}/staking/setup`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    const amt = tabA.getByLabel(/Stake amount/i)
    if (await amt.isVisible().catch(() => false)) await amt.fill(STAKE_AMOUNT)
    await shot(tabA, "A-stake-panel", "A stake panel")

    // Prefer chain for reliability under RPC
    await withRetry("storage_deposit", async () => {
      const { account } = await nearAccount(creds.A.accountId)
      return account.functionCall({
        contractId: STAKING,
        methodName: "storage_deposit",
        args: { account_id: creds.A.accountId, registration_only: false },
        gas: BigInt("30000000000000"),
        attachedDeposit: BigInt("100000000000000000000000"), // 0.1N
      })
    })
    note("storage_deposit ok")

    await withRetry("ft_transfer_call stake", async () => {
      const { account } = await nearAccount(creds.A.accountId)
      return account.functionCall({
        contractId: FT,
        methodName: "ft_transfer_call",
        args: { receiver_id: STAKING, amount: STAKE_AMOUNT, memo: null, msg: "" },
        gas: BigInt("100000000000000"),
        attachedDeposit: 1n,
      })
    })
    note("ft_transfer_call ok")

    await withRetry("delegate", async () => {
      const { account } = await nearAccount(creds.A.accountId)
      return account.functionCall({
        contractId: STAKING,
        methodName: "delegate",
        args: { account_id: creds.A.accountId, amount: STAKE_AMOUNT },
        gas: BigInt("100000000000000"),
        attachedDeposit: 0n,
      })
    })
    note("delegate ok")

    for (let i = 0; i < 15; i++) {
      try {
        delegation = String(await viewFn(DAO, "delegation_balance_of", { account_id: creds.A.accountId }))
        if (BigInt(delegation) > 0n) break
      } catch {}
      await new Promise((r) => setTimeout(r, 2000))
    }
    await tabA.goto(base + `/dao/${DAO}/stake`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    await shot(tabA, "A-stake-done", `A stake done delegation=${delegation}`)
    chain.steps.stakeA = { pass: BigInt(delegation || "0") > 0n, delegation }
  } else {
    chain.steps.stakeA = { pass: true, skipped: true, delegation }
  }
  note(`delegation A=${delegation}`)

  // --- 6) Transfer under TokenWeight ---
  const balDao1 = await viewAccount(DAO)
  const balB0 = await viewAccount(creds.B.accountId)
  const t2 = utils.format.parseNearAmount(TRANSFER2_NEAR)
  await tabA.goto(base + `/dao/${DAO}/treasury`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1500)
  await tabA.getByPlaceholder("receiver.testnet").fill(creds.B.accountId)
  await tabA.locator('input[placeholder="amount in yoctoNEAR"]').fill(t2)
  await tabA.getByPlaceholder("description").fill(`TokenWeight Transfer ${TRANSFER2_NEAR}N → B`)
  await shot(tabA, "A-tw-transfer-form", "A TokenWeight Transfer form")
  if (await safeClick(tabA, tabA.getByRole("button", { name: /Add Transfer proposal/i }), "UI TW Transfer")) {
    await tabA.waitForTimeout(15000)
  } else {
    await chainAddProposal(`TokenWeight Transfer ${TRANSFER2_NEAR}N → B`, {
      Transfer: { token_id: "", receiver_id: creds.B.accountId, amount: t2, msg: null },
    })
  }
  const t2Id = await newestProposalId()
  chain.proposals.transferTw = { id: t2Id }
  await shot(tabA, "A-tw-transfer-submitted", `Transfer #${t2Id} submitted`)

  // B zero-weight rejection (UI gate)
  await connectKeypair(tabB, creds.B)
  await tabB.goto(base + `/dao/${DAO}/proposals/${t2Id}`, { waitUntil: "domcontentloaded" })
  await tabB.waitForTimeout(2500)
  await shot(tabB, "B-tw-zero-before", `B before zero-weight approve #${t2Id}`)
  const bApprove = tabB.getByRole("button", { name: /Approve exact kind/i })
  if (await bApprove.isEnabled().catch(() => false)) {
    await safeClick(tabB, bApprove, "B zero-weight attempt")
    await tabB.waitForTimeout(4000)
  }
  const bodyB = (await tabB.textContent("body").catch(() => "")) ?? ""
  const zeroReject = /Zero voting weight/i.test(bodyB)
  await shot(tabB, "B-tw-zero-reject", `B zero-weight UI reject=${zeroReject}`)
  chain.steps.zeroWeightReject = { pass: zeroReject, snippet: bodyB.slice(0, 200) }
  // confirm still InProgress
  let t2p = await viewFn(DAO, "get_proposal", { id: t2Id })
  note(`after B attempt status=${t2p.status}`)

  // A approve with weight
  await tabA.goto(base + `/dao/${DAO}/proposals/${t2Id}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-tw-proposal", `A #${t2Id} before weight vote`)
  if (t2p.status === "InProgress") {
    const aApprove = tabA.getByRole("button", { name: /Approve exact kind/i })
    if (await aApprove.isEnabled().catch(() => false)) {
      await safeClick(tabA, aApprove, "A TokenWeight VoteApprove")
      await tabA.waitForTimeout(15000)
    } else {
      await chainVote("A", t2Id, t2p.kind)
    }
  }
  t2p = await waitProposal(t2Id, ["Approved", "Rejected", "InProgress"], 25)
  await tabA.goto(base + `/dao/${DAO}/proposals/${t2Id}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-tw-final", `Final #${t2Id} ${t2p.status}`)

  const balDao2 = await viewAccount(DAO)
  const balB1 = await viewAccount(creds.B.accountId)
  const daoDebit = (balDao1?.near ?? 0) - (balDao2?.near ?? 0)
  chain.steps.transferTw = {
    pass: t2p.status === "Approved" && daoDebit >= Number(TRANSFER2_NEAR) * 0.99,
    status: t2p.status,
    proposalId: t2Id,
    daoDebit,
    bGain: (balB1?.near ?? 0) - (balB0?.near ?? 0),
  }

  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-dao-final", "A DAO hub after TokenWeight beat")

  chain.balancesAfter = {
    A: (await viewAccount(creds.A.accountId))?.near,
    B: balB1?.near,
    C: (await viewAccount(creds.C.accountId))?.near,
    DAO: balDao2?.near,
  }
  chain.delegationA = delegation
  chain.policyWeight = (await viewFn(DAO, "get_policy")).default_vote_policy.weight_kind
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps)
      .filter(([k]) => k !== "summary")
      .map(([k, v]) => [k, v?.pass ?? null]),
  )
  note(`DONE weight=${chain.policyWeight} next=${frameN} summary=${JSON.stringify(chain.steps.summary)}`)
} catch (e) {
  note(`FATAL ${String(e.stack || e).slice(0, 800)}`)
  chain.fatal = String(e.message || e)
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps)
      .filter(([k]) => k !== "summary")
      .map(([k, v]) => [k, v?.pass ?? null]),
  )
} finally {
  fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
  fs.writeFileSync(path.join(out, "_tw114-log.txt"), log.join("\n"))
  await browser.close()
}

console.log(
  JSON.stringify(
    {
      nextFrame: chain.nextFrame,
      steps: chain.steps.summary,
      proposals: chain.proposals,
      stakingId: STAKING,
      policyWeight: chain.policyWeight,
      balancesAfter: chain.balancesAfter,
      fatal: chain.fatal ?? null,
    },
    null,
    2,
  ),
)
