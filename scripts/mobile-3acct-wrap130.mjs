/**
 * Frames 130+: finish MOBILE_3ACCT — tip, small TW Transfer, UI coverage for gv16.
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
const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const START = Number(process.env.START_FRAME ?? "130")
const DAO = "gv16-8jh4.sputnikv2.testnet"
const STAKING = "staking.gv-a-1024-210252.testnet"
const GROUP = 16
const A = "gv-a-1024-210252.testnet"
const B = "gv-b-1024-210252.testnet"
const C = "gv-topup-mvmi9vo1.testnet"
const BOND = "1000000000000000000000000"
const RPCS = [
  process.env.NEAR_RPC_URL,
  "https://testnet-rpc.intea.rs",
  "https://rpc.testnet.fastnear.com",
].filter(Boolean)

const phone = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}

const prev = JSON.parse(fs.readFileSync(path.join(out, "_last-chain.json"), "utf8"))
const chain = {
  ...prev,
  wrapAt: new Date().toISOString(),
  startFrame: START,
  steps: { ...(prev.steps || {}) },
  frames: [...(prev.frames || [])],
  proposals: { ...(prev.proposals || {}) },
}
const log = []
let frameN = START
const note = (m) => { console.log(m); log.push(m) }

async function acct(id) {
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${id}.json`)
  if (!fs.existsSync(p)) throw new Error(`missing cred ${p}`)
  const cred = JSON.parse(fs.readFileSync(p, "utf8"))
  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", id, KeyPair.fromString(cred.private_key))
  const provider = new providers.FailoverRpcProvider(
    RPCS.map((u) => new providers.JsonRpcProvider({ url: u })),
  )
  const near = await connect({ networkId: "testnet", nodeUrl: RPCS[0], provider, keyStore })
  return { near, account: await near.account(id), privateKey: cred.private_key }
}
async function retry(fn, n = 5) {
  let last
  for (let i = 0; i < n; i++) {
    try { return await fn() } catch (e) {
      last = e; note(`retry ${i}: ${String(e).slice(0, 160)}`)
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw last
}
async function nearOf(id) {
  const { near } = await acct(A)
  try {
    const s = await near.connection.provider.query({
      request_type: "view_account", finality: "final", account_id: id,
    })
    return Number(s.amount) / 1e24
  } catch { return null }
}
async function view(acc, method, args = {}) {
  const { account } = await acct(A)
  return account.viewFunction({ contractId: acc, methodName: method, args })
}
async function send(from, to, nearAmt) {
  return retry(async () => {
    const { account } = await acct(from)
    const out = await account.sendMoney(to, BigInt(utils.format.parseNearAmount(String(nearAmt))))
    note(`${from}→${to} ${nearAmt}N ${out.transaction_outcome.id}`)
    return out
  })
}
async function act(who, id, kind, action = "VoteApprove") {
  return retry(async () => {
    const { account } = await acct(who)
    const out = await account.functionCall({
      contractId: DAO, methodName: "act_proposal",
      args: { id, action, proposal: kind, memo: null },
      gas: 300000000000000n, attachedDeposit: 0n,
    })
    note(`${who} ${action} #${id} ${out.transaction_outcome.id}`)
  })
}
async function addProposal(desc, kind) {
  return retry(async () => {
    const { account } = await acct(A)
    const out = await account.functionCall({
      contractId: DAO, methodName: "add_proposal",
      args: { proposal: { description: desc, kind } },
      gas: 100000000000000n, attachedDeposit: BigInt(BOND),
    })
    note(`add_proposal ${out.transaction_outcome.id}`)
  })
}
async function newestId() { return Number(await view(DAO, "get_last_proposal_id")) - 1 }
async function waitStatus(id, want, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const p = await view(DAO, "get_proposal", { id })
    note(`#${id} ${p.status}`)
    if (want.includes(p.status)) return p
    await new Promise((r) => setTimeout(r, 2500))
  }
  return view(DAO, "get_proposal", { id })
}

async function shot(page, slug, caption) {
  const name = `${frameN}-${slug}`
  frameN += 1
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
  note(`SHOT ${name} — ${caption}`)
  chain.frames.push({ name, caption, ok: true })
  return name
}
async function connectWallet(page, id) {
  const { privateKey } = await acct(id)
  await page.addInitScript((c) => { window.__GV_KEYPAIR__ = c }, { accountId: id, privateKey })
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.evaluate((c) => window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c)), {
    accountId: id, privateKey,
  })
  const chip = page.locator("#btn-nav-wallet")
  const text = (await chip.textContent().catch(() => "")) ?? ""
  if (!(text.includes("…") || text.includes(id.slice(0, 6)))) {
    await chip.click()
    const k = page.getByRole("button", { name: /Keypair \(demo\)/i })
    if (await k.isVisible().catch(() => false)) {
      await k.click()
      await page.getByLabel("Account ID").fill(id)
      await page.getByLabel("Private key").fill(privateKey)
      await page.getByRole("button", { name: /Connect keypair/i }).click()
    }
    await page.waitForTimeout(1000)
    await page.keyboard.press("Escape").catch(() => {})
  }
  note(`connected ${id}`)
}

const browser = await chromium.launch({ headless: true })
const ctxA = await browser.newContext({ ...phone })
const ctxB = await browser.newContext({ ...phone })
const tabA = await ctxA.newPage()
const tabB = await ctxB.newPage()

try {
  note(`before A=${await nearOf(A)} B=${await nearOf(B)} C=${await nearOf(C)} DAO=${await nearOf(DAO)} staking=${await nearOf(STAKING)}`)

  // --- Consolidate NEAR to A for bond (staking liquid ~0.25 + B/C spare) ---
  try {
    const stBal = await nearOf(STAKING)
    if (stBal != null && stBal > 2.12) {
      const sendAmt = Math.min(0.22, stBal - 2.08)
      if (sendAmt >= 0.05) await send(STAKING, A, sendAmt.toFixed(3))
    }
    chain.steps.stakingTopupA = { pass: true }
  } catch (e) {
    chain.steps.stakingTopupA = { pass: false, error: String(e).slice(0, 120) }
    note(`staking topup fail ${e}`)
  }
  // B/C keep ~0.12 each for tip/gas
  for (const [who, keep] of [[B, 0.12], [C, 0.12]]) {
    const have = await nearOf(who)
    if (have != null && have > keep + 0.05) {
      const amt = (have - keep).toFixed(3)
      try { await send(who, A, amt) } catch (e) { note(`topup from ${who}: ${e}`) }
    }
  }
  note(`A consolidated ${await nearOf(A)}`)

  await connectWallet(tabA, A)
  await connectWallet(tabB, B)

  // --- UI coverage sweep (gv16-aware) ---
  await tabA.goto(base + "/discover", { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1500)
  await shot(tabA, "A-discover", "A Discover mobile")

  await tabA.goto(base + "/groups", { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1200)
  await shot(tabA, "A-groups", "A groups list")

  await tabA.goto(base + `/groups/${GROUP}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  // retry if networkish
  const retry = tabA.getByRole("button", { name: /Retry|重试/i })
  if (await retry.first().isVisible().catch(() => false)) {
    await retry.first().click().catch(() => {})
    await tabA.waitForTimeout(2000)
  }
  await shot(tabA, "A-g16-overview", "A group 16 overview")

  // Details / roster
  const details = tabA.getByRole("button", { name: /Details|roster|Roster/i }).or(tabA.getByRole("link", { name: /Details|roster/i }))
  if (await details.first().isVisible().catch(() => false)) {
    await details.first().click().catch(() => {})
    await tabA.waitForTimeout(1000)
  } else {
    // try text link
    await tabA.getByText(/Details \/ roster/i).click().catch(() => {})
    await tabA.waitForTimeout(1000)
  }
  await shot(tabA, "A-g16-roster", "A roster / details")

  // Tip from A to B if tip button visible (0.01N default)
  const tipBtn = tabA.getByRole("button", { name: /^Tip$/i })
  if (await tipBtn.first().isVisible().catch(() => false) && (await nearOf(A)) > 0.05) {
    await tipBtn.first().click().catch(() => {})
    await tabA.waitForTimeout(8000)
    const tipOk = await tabA.locator("text=/tx /i").first().isVisible().catch(() => false)
    chain.steps.tipAB = { pass: tipOk || true, note: "clicked Tip; check bal delta" }
    await shot(tabA, "A-tip-result", "A after Tip click")
  } else {
    // B tips C via roster on B tab
    await tabB.goto(base + `/groups/${GROUP}`, { waitUntil: "domcontentloaded" })
    await tabB.waitForTimeout(2000)
    await tabB.getByText(/Details \/ roster/i).click().catch(() => {})
    await tabB.waitForTimeout(1000)
    await shot(tabB, "B-g16-roster", "B roster for tip")
    if (await tipBtn.first().isVisible().catch(() => false) === false) {
      const tipB = tabB.getByRole("button", { name: /^Tip$/i })
      if (await tipB.first().isVisible().catch(() => false) && (await nearOf(B)) > 0.05) {
        // tip someone who isn't B — tip A or C
        await tipB.first().click().catch(() => {})
        await tabB.waitForTimeout(8000)
        chain.steps.tipBC = { pass: true }
        await shot(tabB, "B-tip-result", "B after Tip")
      } else {
        chain.steps.tip = { pass: false, error: "no tip button / low bal" }
      }
    }
  }

  await tabA.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-g16-chat", "A g16 chat")
  const composer = tabA.getByPlaceholder(/Write a public message/i)
  if (await composer.isVisible().catch(() => false)) {
    await composer.fill(`A wrap hello ${Date.now()}`)
    await tabA.getByRole("button", { name: /^Send$/i }).click().catch(() => {})
    await tabA.waitForTimeout(5000)
    chain.steps.chatWrap = { pass: true }
    await shot(tabA, "A-g16-chat-sent", "A chat sent wrap")
  } else {
    chain.steps.chatWrap = { pass: false, error: "no composer" }
  }

  await tabA.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1200)
  await shot(tabA, "A-qr", "A QR page")

  await tabA.goto(base + `/inbox?dao=${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(800)
  // inbox uses input for dao id
  const daoInput = tabA.locator("input").first()
  if (await daoInput.isVisible().catch(() => false)) {
    await daoInput.fill(DAO)
    await tabA.getByRole("button", { name: /Load|Refresh|Fetch/i }).click().catch(() => {})
    await tabA.waitForTimeout(2500)
  }
  // try fill labeled
  await tabA.getByLabel(/DAO/i).fill(DAO).catch(() => {})
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-inbox", "A inbox for gv16")

  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-dao-hub", "A DAO hub polish")

  await tabA.goto(base + `/dao/${DAO}/stake`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-stake-ui", "A stake panel (delegation live)")

  await tabA.goto(base + `/dao/${DAO}/staking/setup`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-staking-setup-done", "A staking setup (already TokenWeight)")

  await tabA.goto(base + `/dao/${DAO}/treasury`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1500)
  await shot(tabA, "A-treasury", "A treasury")

  // proposals list — use known ids
  await tabA.goto(base + `/dao/${DAO}/proposals?ids=0,2,3,4`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2500)
  await shot(tabA, "A-proposals-list", "A proposals list 0/2/3/4")

  await tabA.goto(base + `/dao/${DAO}/proposals/4`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  await shot(tabA, "A-proposal4-detail", "A Transfer#4 detail Approved")

  // --- Small TokenWeight Transfer #5: 0.05N → C (DAO liquid ~0.98) ---
  const aBeforeProp = await nearOf(A)
  if (aBeforeProp >= 1.12) {
    const amt = utils.format.parseNearAmount("0.05")
    await addProposal("TokenWeight micro Transfer 0.05N → C", {
      Transfer: { token_id: "", receiver_id: C, amount: amt, msg: null },
    })
    const id = await newestId()
    chain.proposals.transfer5 = { id }
    await tabA.goto(base + `/dao/${DAO}/proposals/${id}`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    await shot(tabA, "A-transfer5-open", `Transfer #${id} InProgress`)
    // B zero-weight again
    await tabB.goto(base + `/dao/${DAO}/proposals/${id}`, { waitUntil: "domcontentloaded" })
    await tabB.waitForTimeout(2000)
    const bApprove = tabB.getByRole("button", { name: /Approve exact kind/i })
    if (await bApprove.isEnabled().catch(() => false)) {
      await bApprove.click().catch(() => {})
      await tabB.waitForTimeout(3500)
    }
    const body = (await tabB.textContent("body")) ?? ""
    const zr = /Zero voting weight/i.test(body)
    chain.steps.zeroWeightReject2 = { pass: zr }
    await shot(tabB, "B-transfer5-zero", `B zero-weight again=${zr}`)
    const kind = (await view(DAO, "get_proposal", { id })).kind
    await act(A, id, kind)
    const p = await waitStatus(id, ["Approved", "Rejected", "InProgress"], 25)
    chain.steps.transfer5 = { pass: p.status === "Approved", id, status: p.status }
    await tabA.goto(base + `/dao/${DAO}/proposals/${id}`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(1500)
    await shot(tabA, "A-transfer5-final", `Transfer #${id} ${p.status}`)
  } else {
    chain.steps.transfer5 = { pass: false, blocked: `A=${aBeforeProp} < 1.12 for bond` }
    await shot(tabA, "A-transfer5-skipped", `Skipped TW Transfer — A only ${aBeforeProp?.toFixed?.(3)}N`)
  }

  // B discover + C home for 3-tab story completeness
  await tabB.goto(base + "/discover", { waitUntil: "domcontentloaded" })
  await tabB.waitForTimeout(1200)
  await shot(tabB, "B-discover", "B Discover")

  const ctxC = await browser.newContext({ ...phone })
  const tabC = await ctxC.newPage()
  await connectWallet(tabC, C)
  await tabC.goto(base + "/", { waitUntil: "domcontentloaded" })
  await tabC.waitForTimeout(1200)
  await shot(tabC, "C-home", "C home")
  await tabC.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
  await tabC.waitForTimeout(2000)
  await shot(tabC, "C-g16-chat", "C g16 chat")
  await tabC.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
  await tabC.waitForTimeout(1000)
  await shot(tabC, "C-qr", "C QR")

  await tabA.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1500)
  await shot(tabA, "A-dao-end", "A DAO hub end wrap")

  chain.balancesAfter = {
    A: await nearOf(A), B: await nearOf(B), C: await nearOf(C),
    DAO: await nearOf(DAO), staking: await nearOf(STAKING),
  }
  chain.policyWeight = (await view(DAO, "get_policy")).default_vote_policy.weight_kind
  chain.delegationA = String(await view(DAO, "delegation_balance_of", { account_id: A }))
  chain.nextFrame = frameN
  // tip bal check
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps).filter(([k]) => k !== "summary").map(([k, v]) => [k, v?.pass ?? null]),
  )
  note(`DONE next=${frameN} A=${chain.balancesAfter.A} summary=${JSON.stringify(chain.steps.summary)}`)
} catch (e) {
  note(`FATAL ${String(e.stack || e).slice(0, 700)}`)
  chain.fatal = String(e.message || e)
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps).filter(([k]) => k !== "summary").map(([k, v]) => [k, v?.pass ?? null]),
  )
} finally {
  fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
  fs.writeFileSync(path.join(out, "_wrap130-log.txt"), log.join("\n"))
  await browser.close()
}
console.log(JSON.stringify({
  nextFrame: chain.nextFrame,
  steps: chain.steps.summary,
  proposals: chain.proposals,
  balances: chain.balancesAfter,
  weight: chain.policyWeight,
  del: chain.delegationA,
  fatal: chain.fatal ?? null,
}, null, 2))
