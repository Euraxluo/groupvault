/**
 * Continue MOBILE_3ACCT_STORY from frame 74.
 * Fresh group as A → B join → C join → A/B/C chat → Convert (5N).
 * Phone viewport 390×844, fullPage: false.
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { connect, keyStores, KeyPair, providers } from "near-api-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/hub-qa/mobile-3acct")
fs.mkdirSync(out, { recursive: true })

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const START = Number(process.env.START_FRAME ?? "74")
const GV = process.env.GROUPVAULT_CONTRACT_ID ?? "gv-deployer-1024-204559-groupvault.testnet"
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
  C: process.env.DEMO_ACCOUNT_C ?? "gv-topup-mvmi9vo1.testnet",
}

function loadCred(who) {
  const accountId = process.env[`DEMO_ACCOUNT_${who}`] ?? DEFAULTS[who]
  if (process.env[`DEMO_PRIVATE_KEY_${who}`]) {
    return { accountId, privateKey: process.env[`DEMO_PRIVATE_KEY_${who}`].trim(), who }
  }
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${accountId}.json`)
  if (!fs.existsSync(p)) throw new Error(`Missing credential ${p}`)
  const j = JSON.parse(fs.readFileSync(p, "utf8"))
  return { accountId: j.account_id ?? accountId, privateKey: j.private_key, who }
}

const creds = { A: loadCred("A"), B: loadCred("B"), C: loadCred("C") }
const log = []
const chain = {
  at: new Date().toISOString(),
  startFrame: START,
  frames: [],
  steps: {},
  groupId: null,
  daoId: null,
  groupName: null,
  aNearBefore: null,
  aNearAfter: null,
}
let frameN = START

function note(msg) {
  console.log(msg)
  log.push(msg)
}

async function shot(page, slug, caption) {
  const name = `${String(frameN).padStart(2, "0")}-${slug}`
  frameN += 1
  const file = path.join(out, `${name}.png`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: file, fullPage: false })
  note(`SHOT ${name} — ${caption}`)
  chain.frames.push({ name, caption, ok: true })
  return name
}

async function rpcCall(method, params) {
  let last
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
        signal: AbortSignal.timeout(20_000),
      })
      const j = await res.json()
      if (j.error) {
        last = new Error(JSON.stringify(j.error))
        if (/429|Rate limit/i.test(String(j.error.message || ""))) continue
        // continue on HTTP-ish provider errors
        continue
      }
      return j.result
    } catch (e) {
      last = e
    }
  }
  throw last ?? new Error("all RPC failed")
}

async function viewAccount(accountId) {
  const r = await rpcCall("query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return Number(r.amount) / 1e24
}

async function viewFn(accountId, methodName, args) {
  const args_base64 = Buffer.from(JSON.stringify(args)).toString("base64")
  const r = await rpcCall("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64,
  })
  return JSON.parse(Buffer.from(r.result).toString())
}

async function getGroup(id) {
  return viewFn(GV, "get_group", { group_id: id })
}
async function getMembers(id) {
  return viewFn(GV, "get_members", { group_id: id })
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
    note(`Tab ${cred.who} chip: ${text.trim()}`)
    return
  }

  await chip.click()
  const keypairBtn = page.getByRole("button", { name: /Keypair \(demo\)/i })
  if (await keypairBtn.isVisible().catch(() => false)) {
    await keypairBtn.click()
    await page.getByLabel("Account ID").fill(cred.accountId)
    await page.getByLabel("Private key").fill(cred.privateKey)
    await page.getByRole("button", { name: /Connect keypair/i }).click()
  } else if (await page.getByRole("button", { name: /Connect wallet/i }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Connect wallet/i }).click()
  }
  await page.waitForTimeout(1500)
  await page.keyboard.press("Escape").catch(() => {})
  note(`Tab ${cred.who} connected as ${cred.accountId}`)
}

async function safeClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 10_000 })
    note(`click ok: ${label}`)
    return true
  } catch (e) {
    note(`click FAIL: ${label} — ${String(e.message || e).slice(0, 140)}`)
    return false
  }
}

async function waitForMember(groupId, accountId, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const m = await getMembers(groupId)
      if (m.includes(accountId)) return m
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
  }
  return getMembers(groupId).catch(() => [])
}

async function waitForDao(groupId, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const g = await getGroup(groupId)
      if (g.dao_id) return g
      note(`convert poll ${i}: dao_id=${g.dao_id} pending=${g.convert_pending}`)
    } catch (e) {
      note(`convert poll err ${i}: ${String(e).slice(0, 100)}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return getGroup(groupId)
}

const browser = await chromium.launch({ headless: true })
const ctxA = await browser.newContext({ ...phone })
const ctxB = await browser.newContext({ ...phone })
const ctxC = await browser.newContext({ ...phone })
const tabA = await ctxA.newPage()
const tabB = await ctxB.newPage()
const tabC = await ctxC.newPage()

try {
  chain.aNearBefore = await viewAccount(creds.A.accountId)
  note(`A balance before: ${chain.aNearBefore.toFixed(4)} N`)
  chain.steps.balanceA = { pass: chain.aNearBefore >= 5.5, near: chain.aNearBefore }

  // --- A create ---
  await connectKeypair(tabA, creds.A)
  await shot(tabA, "A-home", "A connected home")

  await tabA.goto(base + "/groups/new", { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(800)
  await shot(tabA, "A-create-form", "A create group form")

  const suffix = Date.now().toString(36).slice(-5)
  const name = `Mobile3 ${suffix}`
  chain.groupName = name

  // Dialog may already be open on /groups/new
  let nameField = tabA.getByLabel(/^Name$/i)
  if (!(await nameField.isVisible().catch(() => false))) {
    await safeClick(tabA, tabA.getByRole("button", { name: /Open create form/i }), "Open create form")
    await tabA.waitForTimeout(400)
    nameField = tabA.getByLabel(/^Name$/i)
  }
  await nameField.fill(name)
  const fee = tabA.getByLabel(/Join fee/i)
  if (await fee.isVisible().catch(() => false)) await fee.fill("1000000")

  const created = await safeClick(
    tabA,
    tabA.getByRole("button", { name: /Create group/i }),
    "A create_group",
  )
  let groupId = null
  if (created) {
    try {
      await tabA.waitForURL(/\/groups\/\d+/, { timeout: 120_000 })
      groupId = Number(tabA.url().split("/").pop())
      note(`Fresh group ${groupId}`)
    } catch (e) {
      note(`Create navigate fail: ${String(e.message || e).slice(0, 140)}`)
      // try recover from chain: newest owned group
      try {
        const groups = await viewFn(GV, "get_groups", { from_index: 0, limit: 50 })
        const owned = groups.filter((g) => g.owner === creds.A.accountId && g.name === name)
        if (owned.length) groupId = owned.sort((a, b) => b.id - a.id)[0].id
      } catch {}
    }
  }
  if (!groupId) {
    chain.steps.create = { pass: false, error: "no groupId" }
    throw new Error("Create group failed — aborting story")
  }
  chain.groupId = groupId
  let gView = await getGroup(groupId)
  chain.steps.create = { pass: true, groupId, name: gView.name, member_count: gView.member_count }

  await tabA.goto(base + `/groups/${groupId}`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1200)
  await shot(tabA, "A-overview", `A group ${groupId} overview`)

  await tabA.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(1500)
  await shot(tabA, "A-chat", "A chat before send")
  const aComposer = tabA.getByPlaceholder(/Write a public message/i)
  if (await aComposer.isVisible().catch(() => false)) {
    await aComposer.fill(`A mobile hello ${Date.now()}`)
    if (await safeClick(tabA, tabA.getByRole("button", { name: /^Send$/i }), "A send")) {
      await tabA.waitForTimeout(5000)
      chain.steps.chatA = { pass: true }
      await shot(tabA, "A-chat-sent", "A after send")
    } else {
      chain.steps.chatA = { pass: false }
      await shot(tabA, "A-chat-send-fail", "A send click failed")
    }
  } else {
    chain.steps.chatA = { pass: false, error: "no composer" }
    await shot(tabA, "A-chat-no-composer", "A no composer")
  }

  // --- B join ---
  await connectKeypair(tabB, creds.B)
  await shot(tabB, "B-home", "B connected home")
  await tabB.goto(base + `/groups/${groupId}/join`, { waitUntil: "domcontentloaded" })
  await tabB.waitForTimeout(1500)
  await shot(tabB, "B-join", `B join wall ${groupId}`)
  const payB = tabB.getByRole("button", { name: /Pay and join/i })
  if (await payB.isEnabled().catch(() => false)) {
    if (await safeClick(tabB, payB, "B join")) {
      await tabB.waitForTimeout(12000)
      await shot(tabB, "B-join-result", "B after join click")
    }
  } else {
    note("B join CTA disabled")
    await shot(tabB, "B-join-disabled", "B join disabled")
  }
  {
    const members = await waitForMember(groupId, creds.B.accountId)
    const ok = members.includes(creds.B.accountId)
    chain.steps.joinB = { pass: ok, members }
    note(`B member? ${ok} members=${JSON.stringify(members)}`)
  }

  await tabB.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await tabB.waitForTimeout(1500)
  await shot(tabB, "B-chat", "B chat")
  const bComposer = tabB.getByPlaceholder(/Write a public message/i)
  if (await bComposer.isVisible().catch(() => false)) {
    await bComposer.fill(`B mobile ping ${Date.now()}`)
    if (await safeClick(tabB, tabB.getByRole("button", { name: /^Send$/i }), "B send")) {
      await tabB.waitForTimeout(5000)
      chain.steps.chatB = { pass: true }
      await shot(tabB, "B-chat-sent", "B after send")
    } else {
      chain.steps.chatB = { pass: false }
    }
  } else {
    chain.steps.chatB = { pass: false, error: "no composer" }
    await shot(tabB, "B-chat-no-composer", "B no composer")
  }

  // --- C join ---
  await connectKeypair(tabC, creds.C)
  await shot(tabC, "C-home", "C connected home")
  await tabC.goto(base + `/groups/${groupId}/join`, { waitUntil: "domcontentloaded" })
  await tabC.waitForTimeout(1500)
  await shot(tabC, "C-join", `C join wall ${groupId}`)
  const payC = tabC.getByRole("button", { name: /Pay and join/i })
  if (await payC.isEnabled().catch(() => false)) {
    if (await safeClick(tabC, payC, "C join")) {
      await tabC.waitForTimeout(12000)
      await shot(tabC, "C-join-result", "C after join click")
    }
  } else {
    note("C join CTA disabled")
    await shot(tabC, "C-join-disabled", "C join disabled")
  }
  {
    const members = await waitForMember(groupId, creds.C.accountId)
    const ok = members.includes(creds.C.accountId)
    chain.steps.joinC = { pass: ok, members }
    note(`C member? ${ok} members=${JSON.stringify(members)}`)
  }

  await tabC.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await tabC.waitForTimeout(1500)
  await shot(tabC, "C-chat", "C chat")
  const cComposer = tabC.getByPlaceholder(/Write a public message/i)
  if (await cComposer.isVisible().catch(() => false)) {
    await cComposer.fill(`C mobile here ${Date.now()}`)
    if (await safeClick(tabC, tabC.getByRole("button", { name: /^Send$/i }), "C send")) {
      await tabC.waitForTimeout(5000)
      chain.steps.chatC = { pass: true }
      await shot(tabC, "C-chat-sent", "C after send")
    } else {
      chain.steps.chatC = { pass: false }
    }
  } else {
    chain.steps.chatC = { pass: false, error: "no composer" }
    await shot(tabC, "C-chat-no-composer", "C no composer")
  }

  // --- Convert ---
  await tabA.goto(base + `/groups/${groupId}/convert`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(2000)
  // Retry load if needed
  const retry = tabA.getByRole("button", { name: /Retry load/i })
  if (await retry.isVisible().catch(() => false)) {
    await retry.click()
    await tabA.waitForTimeout(2000)
  }
  await shot(tabA, "A-convert", "A convert form")

  const daoNameField = tabA.getByLabel(/DAO name/i)
  if (await daoNameField.isVisible().catch(() => false)) {
    const current = await daoNameField.inputValue().catch(() => "")
    if (!current) await daoNameField.fill(`gv${groupId}-${suffix}`)
  }
  const convertBtn = tabA.getByRole("button", { name: /Convert with wallet/i })
  const enabled = await convertBtn.isEnabled().catch(() => false)
  note(`Convert CTA enabled=${enabled}`)
  if (enabled) {
    if (await safeClick(tabA, convertBtn, "A convert")) {
      await tabA.waitForTimeout(15000)
      await shot(tabA, "A-convert-waiting", "A after convert click")
      gView = await waitForDao(groupId)
      chain.daoId = gView.dao_id
      chain.steps.convert = {
        pass: Boolean(gView.dao_id),
        dao_id: gView.dao_id,
        convert_pending: gView.convert_pending,
      }
      note(`Convert result dao_id=${gView.dao_id}`)
      await tabA.goto(base + `/groups/${groupId}/convert`, { waitUntil: "domcontentloaded" })
      await tabA.waitForTimeout(1500)
      await shot(tabA, "A-convert-result", "A convert final UI")
      if (gView.dao_id) {
        await tabA.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
        await tabA.waitForTimeout(1500)
        await shot(tabA, "A-chat-post-convert", "A chat-first after convert")
        await tabA.goto(base + `/dao/${gView.dao_id}`, { waitUntil: "domcontentloaded" })
        await tabA.waitForTimeout(1500)
        await shot(tabA, "A-dao-hub", `A DAO hub ${gView.dao_id}`)
      }
    } else {
      chain.steps.convert = { pass: false, error: "click failed" }
    }
  } else {
    const body = (await tabA.textContent("body").catch(() => "")) ?? ""
    chain.steps.convert = { pass: false, error: "CTA disabled", snippet: body.slice(0, 400) }
    await shot(tabA, "A-convert-disabled", "A convert CTA disabled")
  }

  chain.aNearAfter = await viewAccount(creds.A.accountId)
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    Object.entries(chain.steps)
      .filter(([k]) => k !== "summary")
      .map(([k, v]) => [k, v?.pass ?? null]),
  )
} catch (e) {
  note(`FATAL: ${String(e.stack || e).slice(0, 500)}`)
  chain.fatal = String(e.message || e)
  chain.nextFrame = frameN
} finally {
  fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
  fs.writeFileSync(path.join(out, `_from74-log.txt`), log.join("\n"))
  note(`Wrote chain → _last-chain.json nextFrame=${chain.nextFrame}`)
  await browser.close()
}

console.log(JSON.stringify({ groupId: chain.groupId, daoId: chain.daoId, steps: chain.steps.summary, nextFrame: chain.nextFrame }, null, 2))
