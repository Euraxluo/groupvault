/**
 * Resume group 16 from frame 92: chat A/B/C + Convert (10N live deposit).
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/hub-qa/mobile-3acct")
const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const GROUP_ID = Number(process.env.GROUP_ID ?? "16")
const START = Number(process.env.START_FRAME ?? "92")
const GV = "gv-deployer-1024-204559-groupvault.testnet"
const RPCS = [
  "https://testnet-rpc.intea.rs",
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
]

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

const prev = JSON.parse(fs.readFileSync(path.join(out, "_last-chain.json"), "utf8"))
const chain = {
  ...prev,
  resumeAt: new Date().toISOString(),
  resumeFrom: START,
  steps: { ...prev.steps },
}
const log = []
let frameN = START

function note(msg) {
  console.log(msg)
  log.push(msg)
}

async function shot(page, slug, caption) {
  const name = `${String(frameN).padStart(2, "0")}-${slug}`
  frameN += 1
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false })
  note(`SHOT ${name} — ${caption}`)
  chain.frames = chain.frames || []
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
        continue
      }
      return j.result
    } catch (e) {
      last = e
    }
  }
  throw last
}

async function viewFn(methodName, args) {
  const args_base64 = Buffer.from(JSON.stringify(args)).toString("base64")
  const r = await rpcCall("query", {
    request_type: "call_function",
    finality: "final",
    account_id: GV,
    method_name: methodName,
    args_base64,
  })
  return JSON.parse(Buffer.from(r.result).toString())
}

async function viewAccount(accountId) {
  const r = await rpcCall("query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return Number(r.amount) / 1e24
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

async function waitGroupReady(page, groupId, who) {
  await page.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  for (let i = 0; i < 25; i++) {
    const body = (await page.textContent("body").catch(() => "")) ?? ""
    if (/Write a public message/i.test(body)) {
      note(`${who} composer ready @${i}`)
      return true
    }
    if (/网络繁忙|Retry|重试/i.test(body)) {
      const btn = page.getByRole("button", { name: /Retry|重试|Refresh/i })
      if (await btn.first().isVisible().catch(() => false)) {
        await btn.first().click().catch(() => {})
        note(`${who} clicked retry`)
      }
    }
    // Refresh on chat
    const refresh = page.getByRole("button", { name: /Refresh|Indexing/i })
    if (await refresh.isVisible().catch(() => false) && i % 3 === 2) {
      await refresh.click().catch(() => {})
    }
    await page.waitForTimeout(2000)
    if (i === 8 || i === 16) {
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {})
    }
  }
  note(`${who} composer NOT ready`)
  return false
}

async function safeClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 10_000 })
    note(`click ok: ${label}`)
    return true
  } catch (e) {
    note(`click FAIL: ${label} — ${String(e.message || e).slice(0, 120)}`)
    return false
  }
}

async function waitForDao(groupId, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const g = await viewFn("get_group", { group_id: groupId })
      note(`poll ${i}: dao=${g.dao_id} pending=${g.convert_pending}`)
      if (g.dao_id) return g
    } catch (e) {
      note(`poll err ${i}: ${String(e).slice(0, 80)}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return viewFn("get_group", { group_id: groupId })
}

const browser = await chromium.launch({ headless: true })
const tabs = {}
try {
  for (const who of ["A", "B", "C"]) {
    const ctx = await browser.newContext({ ...phone })
    tabs[who] = await ctx.newPage()
    await connectKeypair(tabs[who], creds[who])
  }

  // Chat each member
  for (const who of ["A", "B", "C"]) {
    const page = tabs[who]
    const ready = await waitGroupReady(page, GROUP_ID, who)
    await shot(page, `${who}-chat-ready`, `${who} chat after wait ready=${ready}`)
    const composer = page.getByPlaceholder(/Write a public message/i)
    if (await composer.isVisible().catch(() => false)) {
      const msg = `${who} mobile resume ${Date.now()}`
      await composer.fill(msg)
      if (await safeClick(page, page.getByRole("button", { name: /^Send$/i }), `${who} send`)) {
        await page.waitForTimeout(6000)
        chain.steps[`chat${who}`] = { pass: true, msg }
        await shot(page, `${who}-chat-sent`, `${who} after send`)
      } else {
        chain.steps[`chat${who}`] = { pass: false, error: "send click" }
      }
    } else {
      chain.steps[`chat${who}`] = { pass: false, error: "no composer after wait" }
      await shot(page, `${who}-chat-still-blocked`, `${who} still no composer`)
    }
  }

  // Convert as A with 10N
  const tabA = tabs.A
  await tabA.goto(base + `/groups/${GROUP_ID}/convert`, { waitUntil: "domcontentloaded" })
  await tabA.waitForTimeout(3000)
  const retry = tabA.getByRole("button", { name: /Retry load/i })
  if (await retry.isVisible().catch(() => false)) {
    await retry.click()
    await tabA.waitForTimeout(2500)
  }
  // Show deposit text
  await shot(tabA, "A-convert-10n", "A convert form (expect 10N deposit)")
  const daoName = tabA.getByLabel(/DAO name/i)
  if (await daoName.isVisible().catch(() => false)) {
    const v = await daoName.inputValue()
    // Use short unique prefix — factory appends .sputnikv2.testnet
    const prefix = `gv16-${Date.now().toString(36).slice(-4)}`
    if (!v || v === "groupvault-16") await daoName.fill(prefix)
    note(`dao name set to ${(await daoName.inputValue())}`)
  }
  const convertBtn = tabA.getByRole("button", { name: /Convert with wallet/i })
  const enabled = await convertBtn.isEnabled().catch(() => false)
  note(`Convert enabled=${enabled}`)
  if (enabled) {
    await safeClick(tabA, convertBtn, "A convert 10N")
    await tabA.waitForTimeout(20000)
    await shot(tabA, "A-convert-submitted", "A after convert submit")
    const g = await waitForDao(GROUP_ID)
    chain.daoId = g.dao_id
    chain.steps.convert = {
      pass: Boolean(g.dao_id),
      dao_id: g.dao_id,
      convert_pending: g.convert_pending,
      depositNear: 10,
    }
    await tabA.goto(base + `/groups/${GROUP_ID}/convert`, { waitUntil: "domcontentloaded" })
    await tabA.waitForTimeout(2000)
    await shot(tabA, "A-convert-final", "A convert final")
    if (g.dao_id) {
      await tabA.goto(base + `/groups/${GROUP_ID}/chat`, { waitUntil: "domcontentloaded" })
      await tabA.waitForTimeout(2000)
      await shot(tabA, "A-chat-post-convert", "A chat after convert")
      await tabA.goto(base + `/dao/${g.dao_id}`, { waitUntil: "domcontentloaded" })
      await tabA.waitForTimeout(2000)
      await shot(tabA, "A-dao-hub", `DAO hub ${g.dao_id}`)
    }
  } else {
    const body = ((await tabA.textContent("body")) ?? "").slice(0, 500)
    chain.steps.convert = { pass: false, error: "disabled", body }
    await shot(tabA, "A-convert-disabled", "convert disabled")
  }

  chain.aNearAfter = await viewAccount(creds.A.accountId)
  chain.nextFrame = frameN
  chain.steps.summary = Object.fromEntries(
    ["balanceA", "create", "joinB", "joinC", "chatA", "chatB", "chatC", "convert"].map((k) => [
      k,
      chain.steps[k]?.pass ?? null,
    ]),
  )
} catch (e) {
  note(`FATAL ${String(e.stack || e).slice(0, 600)}`)
  chain.fatal = String(e.message || e)
  chain.nextFrame = frameN
} finally {
  fs.writeFileSync(path.join(out, "_last-chain.json"), JSON.stringify(chain, null, 2))
  fs.writeFileSync(path.join(out, "_resume92-log.txt"), log.join("\n"))
  await browser.close()
}
console.log(JSON.stringify({ groupId: GROUP_ID, daoId: chain.daoId, steps: chain.steps.summary, nextFrame: chain.nextFrame, aNear: chain.aNearAfter }, null, 2))
