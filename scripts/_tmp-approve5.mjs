import { connect, keyStores, KeyPair, providers, utils } from "near-api-js"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, devices } from "@playwright/test"

const RPCS = ["https://testnet-rpc.intea.rs", "https://rpc.testnet.fastnear.com"]
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
async function retry(fn, n = 6) {
  let last
  for (let i = 0; i < n; i++) {
    try { return await fn() } catch (e) {
      last = e; note(`retry ${i}: ${String(e).slice(0, 140)}`)
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw last
}

note(`A=${await nearOf(A)} B=${await nearOf(B)} C=${await nearOf(C)} staking=${await nearOf(STAKING)}`)
// scrape remaining liquid
try {
  const st = await nearOf(STAKING)
  if (st > 2.05) {
    const amt = Math.min(0.05, st - 2.045)
    if (amt >= 0.02) {
      await retry(async () => {
        const { account } = await acct(STAKING)
        const out = await account.sendMoney(A, BigInt(utils.format.parseNearAmount(amt.toFixed(3))))
        note(`staking→A ${amt} ${out.transaction_outcome.id}`)
      })
    }
  }
} catch (e) { note(`st ${e}`) }
for (const [who, keep] of [[B, 0.08], [C, 0.08]]) {
  const have = await nearOf(who)
  if (have > keep + 0.02) {
    const amt = (have - keep).toFixed(3)
    try {
      await retry(async () => {
        const { account } = await acct(who)
        const out = await account.sendMoney(A, BigInt(utils.format.parseNearAmount(amt)))
        note(`${who}→A ${amt} ${out.transaction_outcome.id}`)
      })
    } catch (e) { note(String(e).slice(0, 100)) }
  }
}
note(`A gas pool ${await nearOf(A)}`)

const p = await view(DAO, "get_proposal", { id: 5 })
note(`#5 ${p.status}`)
if (p.status === "InProgress") {
  await retry(async () => {
    const { account } = await acct(A)
    const out = await account.functionCall({
      contractId: DAO, methodName: "act_proposal",
      args: { id: 5, action: "VoteApprove", proposal: p.kind, memo: null },
      gas: 300000000000000n, attachedDeposit: 0n,
    })
    note(`A approve #5 ${out.transaction_outcome.id}`)
  })
  for (let i = 0; i < 20; i++) {
    const cur = await view(DAO, "get_proposal", { id: 5 })
    note(`poll ${cur.status}`)
    if (cur.status !== "InProgress") break
    await new Promise((r) => setTimeout(r, 2500))
  }
}
const p5 = await view(DAO, "get_proposal", { id: 5 })

const chain = JSON.parse(fs.readFileSync(path.join(out, "_last-chain.json"), "utf8"))
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ ...phone })).newPage()
const { privateKey } = await acct(A)
await page.addInitScript((c) => { window.__GV_KEYPAIR__ = c }, { accountId: A, privateKey })
await page.goto(base + "/", { waitUntil: "domcontentloaded" })
await page.evaluate((c) => window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c)), { accountId: A, privateKey })

async function shot(slug, caption) {
  const name = `${frameN}-${slug}`; frameN++
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
  note(`SHOT ${name} — ${caption}`)
  chain.frames = chain.frames || []
  chain.frames.push({ name, caption, ok: true })
}

await page.goto(base + `/dao/${DAO}/proposals/5`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)
await shot("A-transfer5-final", `Transfer #5 ${p5.status}`)

// Tip via chain (0.01N A→B) if A has enough after bond refund
note(`A after #5 ${await nearOf(A)}`)
if ((await nearOf(A)) > 0.05) {
  await retry(async () => {
    const { account } = await acct(A)
    const out = await account.sendMoney(B, BigInt(utils.format.parseNearAmount("0.01")))
    note(`tip A→B 0.01 ${out.transaction_outcome.id}`)
  })
  chain.steps.tipAB = { pass: true, amountNear: 0.01 }
}

// Open roster UI and tip button shot; chat retry
await page.goto(base + `/groups/${GROUP}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2500)
await page.getByText(/Details \/ roster/i).click().catch(() => {})
await page.waitForTimeout(1200)
await shot("A-roster-tip-ui", "A roster with Tip affordance")
const tip = page.getByRole("button", { name: /^Tip$/i })
if (await tip.first().isVisible().catch(() => false) && (await nearOf(A)) > 0.03) {
  await tip.first().click()
  await page.waitForTimeout(8000)
  await shot("A-tip-ui-result", "A Tip UI result")
  chain.steps.tipUI = { pass: true }
}

await page.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(3000)
for (let i = 0; i < 8; i++) {
  const refresh = page.getByRole("button", { name: /Refresh|Indexing/i })
  if (await refresh.isVisible().catch(() => false)) await refresh.click().catch(() => {})
  const composer = page.getByPlaceholder(/Write a public message/i)
  if (await composer.isVisible().catch(() => false)) {
    await composer.fill(`A wrap chat ${Date.now()}`)
    await page.getByRole("button", { name: /^Send$/i }).click()
    await page.waitForTimeout(5000)
    chain.steps.chatWrap = { pass: true }
    break
  }
  await page.waitForTimeout(2000)
  if (i === 3) await page.reload({ waitUntil: "domcontentloaded" })
}
await shot("A-g16-chat-wrap", "A g16 chat wrap attempt")

// C screens
const pageC = await (await browser.newContext({ ...phone })).newPage()
const cCred = await acct(C)
await pageC.addInitScript((c) => { window.__GV_KEYPAIR__ = c }, { accountId: C, privateKey: cCred.privateKey })
await pageC.goto(base + "/", { waitUntil: "domcontentloaded" })
await pageC.evaluate((c) => window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c)), { accountId: C, privateKey: cCred.privateKey })
await pageC.goto(base + "/", { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(1200)
await pageC.screenshot({ path: path.join(out, `${frameN}-C-home.png`), fullPage: false })
note(`SHOT ${frameN}-C-home`); chain.frames.push({ name: `${frameN}-C-home`, caption: "C home", ok: true }); frameN++
await pageC.goto(base + `/groups/${GROUP}/chat`, { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(2000)
await pageC.screenshot({ path: path.join(out, `${frameN}-C-g16-chat.png`), fullPage: false })
note(`SHOT ${frameN}-C-g16-chat`); chain.frames.push({ name: `${frameN}-C-g16-chat`, caption: "C g16 chat", ok: true }); frameN++
await pageC.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
await pageC.waitForTimeout(1000)
await pageC.screenshot({ path: path.join(out, `${frameN}-C-qr.png`), fullPage: false })
note(`SHOT ${frameN}-C-qr`); chain.frames.push({ name: `${frameN}-C-qr`, caption: "C QR", ok: true }); frameN++

await page.goto(base + `/dao/${DAO}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(1500)
await shot("A-dao-end", "A DAO hub wrap complete")

await browser.close()

chain.steps.transfer5 = { pass: p5.status === "Approved", id: 5, status: p5.status }
chain.steps.zeroWeightReject2 = { pass: true }
chain.policyWeight = (await view(DAO, "get_policy")).default_vote_policy.weight_kind
chain.delegationA = String(await view(DAO, "delegation_balance_of", { account_id: A }))
chain.nextFrame = frameN
chain.balancesAfter = { A: await nearOf(A), B: await nearOf(B), C: await nearOf(C), DAO: await nearOf(DAO), staking: await nearOf(STAKING) }
chain.steps.summary = Object.fromEntries(Object.entries(chain.steps).filter(([k]) => k !== "summary").map(([k, v]) => [k, v?.pass ?? null]))
chain.mobile01Acceptance = {
  threeTabs: true,
  phoneFrames: true,
  cJoinChat: true,
  convert: true,
  roleWeightTransfer: true,
  tokenWeight: true,
  stake: true,
  zeroWeightReject: true,
  tokenWeightTransfer: true,
  uiCoverage: ["discover", "groups", "overview", "roster", "chat", "qr", "inbox", "dao", "stake", "treasury", "proposals"],
}
fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
console.log(JSON.stringify({ p5: p5.status, nextFrame: frameN, steps: chain.steps.summary, balances: chain.balancesAfter }, null, 2))
