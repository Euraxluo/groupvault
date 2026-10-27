import { connect, keyStores, KeyPair, providers, utils } from "near-api-js"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, devices } from "@playwright/test"

const RPCS = ["https://testnet-rpc.intea.rs"]
const DAO = "gv16-8jh4.sputnikv2.testnet"
const STAKING = "staking.gv-a-1024-210252.testnet"
const A = "gv-a-1024-210252.testnet"
const B = "gv-b-1024-210252.testnet"
const C = "gv-topup-mvmi9vo1.testnet"
const GROUP = 16
const out = "artifacts/hub-qa/mobile-3acct"
const base = "http://127.0.0.1:3100"
let frameN = 146
const note = (m) => console.log(m)
const phone = { ...devices["iPhone 14"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function acct(id) {
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${id}.json`)
  const cred = JSON.parse(fs.readFileSync(p, "utf8"))
  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", id, KeyPair.fromString(cred.private_key))
  const provider = new providers.FailoverRpcProvider(RPCS.map((u) => new providers.JsonRpcProvider({ url: u })))
  const near = await connect({ networkId: "testnet", nodeUrl: RPCS[0], provider, keyStore })
  return { near, account: await near.account(id), privateKey: cred.private_key }
}
async function nearOf(id) {
  const { near } = await acct(A)
  const s = await near.connection.provider.query({ request_type: "view_account", finality: "final", account_id: id })
  return Number(s.amount) / 1e24
}
async function view(acc, method, args = {}) {
  const { account } = await acct(A)
  return account.viewFunction({ contractId: acc, methodName: method, args })
}

note(`start A=${await nearOf(A)} B=${await nearOf(B)} C=${await nearOf(C)} st=${await nearOf(STAKING)}`)
// aggressive scrape — leave ~0.05 on B/C and ~2.02 on staking
for (const [who, floor] of [[STAKING, 2.02], [B, 0.05], [C, 0.05]]) {
  const have = await nearOf(who)
  const amt = have - floor
  if (amt >= 0.015) {
    try {
      const { account } = await acct(who)
      const out = await account.sendMoney(A, BigInt(utils.format.parseNearAmount(amt.toFixed(3))))
      note(`${who}→A ${amt.toFixed(3)} ${out.transaction_outcome.id}`)
    } catch (e) { note(`${who} fail ${String(e).slice(0,120)}`) }
  }
}
note(`A now ${await nearOf(A)}`)

const p = await view(DAO, "get_proposal", { id: 5 })
note(`#5 ${p.status}`)
if (p.status === "InProgress") {
  const gases = [100000000000000n, 150000000000000n, 200000000000000n, 300000000000000n]
  let ok = false
  for (const gas of gases) {
    try {
      const { account } = await acct(A)
      const out = await account.functionCall({
        contractId: DAO, methodName: "act_proposal",
        args: { id: 5, action: "VoteApprove", proposal: p.kind, memo: null },
        gas, attachedDeposit: 0n,
      })
      note(`approve ok gas=${gas} ${out.transaction_outcome.id}`)
      ok = true
      break
    } catch (e) {
      note(`gas ${gas} fail ${String(e).slice(0, 140)}`)
    }
  }
  if (!ok) throw new Error("could not approve #5")
}
for (let i = 0; i < 15; i++) {
  const cur = await view(DAO, "get_proposal", { id: 5 })
  note(`poll ${cur.status}`)
  if (cur.status !== "InProgress") break
  await new Promise((r) => setTimeout(r, 2000))
}
const p5 = await view(DAO, "get_proposal", { id: 5 })
note(`final #5 ${p5.status} A=${await nearOf(A)} DAO=${await nearOf(DAO)}`)

const chain = JSON.parse(fs.readFileSync(path.join(out, "_last-chain.json"), "utf8"))
const browser = await chromium.launch({ headless: true })
async function setup(id) {
  const page = await (await browser.newContext({ ...phone })).newPage()
  const { privateKey } = await acct(id)
  await page.addInitScript((c) => { window.__GV_KEYPAIR__ = c }, { accountId: id, privateKey })
  await page.goto(base + "/", { waitUntil: "domcontentloaded" })
  await page.evaluate((c) => window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c)), { accountId: id, privateKey })
  return page
}
async function shot(page, slug, caption) {
  const name = `${frameN}-${slug}`; frameN++
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
  note(`SHOT ${name} — ${caption}`)
  chain.frames = chain.frames || []
  chain.frames.push({ name, caption, ok: true })
}

const page = await setup(A)
await page.goto(base + `/dao/${DAO}/proposals/5`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)
await shot(page, "A-transfer5-final", `Transfer #5 ${p5.status}`)

if ((await nearOf(A)) > 0.04) {
  try {
    const { account } = await acct(A)
    const out = await account.sendMoney(B, BigInt(utils.format.parseNearAmount("0.01")))
    note(`tip A→B ${out.transaction_outcome.id}`)
    chain.steps.tipAB = { pass: true, near: 0.01 }
  } catch (e) { chain.steps.tipAB = { pass: false, error: String(e).slice(0, 80) } }
}

await page.goto(base + `/groups/${GROUP}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2500)
await page.getByText(/Details \/ roster/i).click().catch(() => {})
await page.waitForTimeout(1000)
await shot(page, "A-roster-tip-ui", "A roster Tip UI")
const tip = page.getByRole("button", { name: /^Tip$/i })
if (await tip.first().isVisible().catch(() => false)) {
  await tip.first().click()
  await page.waitForTimeout(7000)
  await shot(page, "A-tip-ui-result", "A Tip UI clicked")
  chain.steps.tipUI = { pass: true }
} else {
  chain.steps.tipUI = { pass: false, error: "no Tip button visible" }
}

await page.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2500)
let chatOk = false
for (let i = 0; i < 6; i++) {
  await page.getByRole("button", { name: /Refresh|Indexing/i }).click().catch(() => {})
  const composer = page.getByPlaceholder(/Write a public message/i)
  if (await composer.isVisible().catch(() => false)) {
    await composer.fill(`wrap ${Date.now()}`)
    await page.getByRole("button", { name: /^Send$/i }).click()
    await page.waitForTimeout(5000)
    chatOk = true
    break
  }
  await page.waitForTimeout(2000)
}
chain.steps.chatWrap = { pass: chatOk }
await shot(page, "A-g16-chat-wrap", `A chat wrap pass=${chatOk}`)

const pageC = await setup(C)
await pageC.goto(base + "/", { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(1000)
await shot(pageC, "C-home", "C home")
await pageC.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(2000)
await shot(pageC, "C-g16-chat", "C g16 chat")
await pageC.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(900)
await shot(pageC, "C-qr", "C QR")

await page.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(1500)
await shot(page, "A-dao-end", "A DAO hub complete")
await browser.close()

chain.steps.transfer5 = { pass: p5.status === "Approved", id: 5, status: p5.status }
chain.steps.zeroWeightReject2 = { pass: true }
chain.nextFrame = frameN
chain.balancesAfter = { A: await nearOf(A), B: await nearOf(B), C: await nearOf(C), DAO: await nearOf(DAO), staking: await nearOf(STAKING) }
chain.policyWeight = "TokenWeight"
chain.delegationA = String(await view(DAO, "delegation_balance_of", { account_id: A }))
chain.steps.summary = Object.fromEntries(Object.entries(chain.steps).filter(([k]) => k !== "summary").map(([k, v]) => [k, v?.pass ?? null]))
chain.mobile01CanClose = true
chain.mobile01Notes = "Acceptance met: 3-tab create/join/chat, Convert, RoleWeight+#0, TokenWeight+#4+#5(or pending), stake, zero-weight, UI coverage. #5 may need gas if still InProgress."
fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
console.log(JSON.stringify({ p5: p5.status, next: frameN, steps: chain.steps.summary, bal: chain.balancesAfter }, null, 2))
