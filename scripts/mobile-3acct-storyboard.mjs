/**
 * Mobile 3-account storyboard: three Playwright browser contexts,
 * phone viewport only, phone-frame screenshots (fullPage: false).
 *
 * Env:
 *   BASE_URL (default http://127.0.0.1:3100)
 *   DEMO_ACCOUNT_A / B / C + optional DEMO_PRIVATE_KEY_*
 *   Or credentials in ~/.near-credentials/testnet/<id>.json
 *   GROUP_ID — reuse existing; omit to try create on Tab A
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/hub-qa/mobile-3acct")
fs.mkdirSync(out, { recursive: true })

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
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
  const accountEnv = `DEMO_ACCOUNT_${who}`
  const keyEnv = `DEMO_PRIVATE_KEY_${who}`
  const accountId = process.env[accountEnv] ?? DEFAULTS[who]
  if (process.env[keyEnv]) {
    return { accountId, privateKey: process.env[keyEnv].trim(), who }
  }
  const p = path.join(os.homedir(), ".near-credentials/testnet", `${accountId}.json`)
  if (!fs.existsSync(p)) throw new Error(`Missing credential ${p}`)
  const j = JSON.parse(fs.readFileSync(p, "utf8"))
  return { accountId: j.account_id ?? accountId, privateKey: j.private_key, who }
}

const creds = {
  A: loadCred("A"),
  B: loadCred("B"),
  C: loadCred("C"),
}

const log = []
function note(msg) {
  console.log(msg)
  log.push(msg)
}

async function shot(page, name, caption) {
  const file = path.join(out, `${name}.png`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: file, fullPage: false })
  note(`SHOT ${name} — ${caption} → ${file}`)
  return file
}

async function connectKeypair(page, cred) {
  await page.addInitScript((c) => {
    window.__GV_KEYPAIR__ = c
  }, { accountId: cred.accountId, privateKey: cred.privateKey })

  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.evaluate((c) => {
    window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(c))
  }, { accountId: cred.accountId, privateKey: cred.privateKey })

  // Already connected via init?
  const chip = page.locator("#btn-nav-wallet")
  const text = (await chip.textContent().catch(() => "")) ?? ""
  if (text.includes("…") || text.includes(cred.accountId.slice(0, 6))) {
    note(`Tab ${cred.who} already showing chip: ${text.trim()}`)
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

async function waitQuiet(page, ms = 800) {
  await page.waitForTimeout(ms)
}

async function safeClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 8_000 })
    note(`click ok: ${label}`)
    return true
  } catch (e) {
    note(`click FAIL: ${label} — ${String(e.message || e).slice(0, 120)}`)
    return false
  }
}

const browser = await chromium.launch({ headless: true })
const ctxA = await browser.newContext({ ...phone })
const ctxB = await browser.newContext({ ...phone })
const ctxC = await browser.newContext({ ...phone })
const tabA = await ctxA.newPage()
const tabB = await ctxB.newPage()
const tabC = await ctxC.newPage()

let groupId = process.env.GROUP_ID ? Number(process.env.GROUP_ID) : null
let daoId = process.env.DAO_ID ?? null
let fresh = false
const clickPath = { ok: [], fail: [] }

try {
  // --- Tab A connect + home ---
  await connectKeypair(tabA, creds.A)
  await shot(tabA, "01-A-home", "Tab A connected on app home")

  await tabA.goto(base + "/groups", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA)
  await shot(tabA, "02-A-groups", "Tab A groups list")

  // Try create fresh group
  await tabA.goto(base + "/groups/new", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA, 600)
  await shot(tabA, "03-A-create-form", "Tab A create group form")

  const name = `Mobile3 ${Date.now().toString(36).slice(-5)}`
  const nameField = tabA.getByLabel(/^Name$/i).or(tabA.getByPlaceholder(/name/i)).first()
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill(name)
    const fee = tabA.getByLabel(/Join fee/i).first()
    if (await fee.isVisible().catch(() => false)) await fee.fill("1000000")
    const created = await safeClick(
      tabA,
      tabA.getByRole("button", { name: /Create group/i }),
      "A create_group",
    )
    if (created) {
      clickPath.ok.push("A create_group")
      try {
        await tabA.waitForURL(/\/groups\/\d+/, { timeout: 90_000 })
        groupId = Number(tabA.url().split("/").pop())
        fresh = true
        note(`Fresh group ${groupId}`)
      } catch (e) {
        note(`Create did not navigate: ${String(e.message || e).slice(0, 120)}`)
        clickPath.fail.push("A create_group navigate")
      }
    } else {
      clickPath.fail.push("A create_group")
    }
  } else {
    // Dialog path from /groups
    await tabA.goto(base + "/groups", { waitUntil: "domcontentloaded" })
    await safeClick(tabA, tabA.getByRole("button", { name: /^New$/i }), "A New")
    await tabA.getByLabel(/^Name$/i).fill(name).catch(() => {})
    await tabA.getByLabel(/Join fee/i).fill("1000000").catch(() => {})
    const created = await safeClick(
      tabA,
      tabA.getByRole("button", { name: /Create group/i }),
      "A create_group dialog",
    )
    if (created) {
      try {
        await tabA.waitForURL(/\/groups\/\d+/, { timeout: 90_000 })
        groupId = Number(tabA.url().split("/").pop())
        fresh = true
      } catch {
        clickPath.fail.push("A create navigate")
      }
    }
  }

  if (!groupId) {
    groupId = 13
    daoId = daoId ?? "groupvault-13.sputnikv2.testnet"
    note(`Reusing demo group ${groupId} / ${daoId}`)
  }

  await tabA.goto(base + `/groups/${groupId}`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA, 1000)
  await shot(tabA, "04-A-overview", `Tab A group ${groupId} overview`)

  await tabA.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA, 1200)
  await shot(tabA, "05-A-chat", "Tab A chat (Chat tab should be active)")

  // Send message if composer present
  const composer = tabA.getByPlaceholder(/Write a public message/i)
  if (await composer.isVisible().catch(() => false)) {
    const msg = `A mobile hello ${Date.now()}`
    await composer.fill(msg)
    if (await safeClick(tabA, tabA.getByRole("button", { name: /^Send$/i }), "A send_message")) {
      clickPath.ok.push("A send_message")
      await waitQuiet(tabA, 4000)
      await shot(tabA, "06-A-chat-sent", "Tab A after send")
    }
  } else {
    await shot(tabA, "06-A-chat-blocked", "Tab A chat without composer")
  }

  // Convert page (may already be converted)
  await tabA.goto(base + `/groups/${groupId}/convert`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA, 1000)
  await shot(tabA, "07-A-convert", "Tab A convert surface")
  const convertBtn = tabA.getByRole("button", { name: /Convert with wallet/i })
  if (await convertBtn.isEnabled().catch(() => false)) {
    if (await safeClick(tabA, convertBtn, "A convert")) {
      clickPath.ok.push("A convert")
      await waitQuiet(tabA, 8000)
      await shot(tabA, "08-A-convert-result", "Tab A after convert attempt")
    }
  } else {
    note("Convert CTA disabled/absent (likely already converted)")
    clickPath.ok.push("A convert skipped-already-dao")
    await shot(tabA, "08-A-convert-already", "Tab A convert already done / blocked")
  }

  // Detect dao_id from page text if needed
  if (!daoId) {
    const body = (await tabA.textContent("body")) ?? ""
    const m = body.match(/groupvault-\d+\.sputnikv2\.testnet/)
    if (m) daoId = m[0]
  }
  if (!daoId && groupId === 13) daoId = "groupvault-13.sputnikv2.testnet"

  if (daoId) {
    await tabA.goto(base + `/dao/${daoId}`, { waitUntil: "domcontentloaded" })
    await waitQuiet(tabA, 1000)
    await shot(tabA, "09-A-dao", `Tab A DAO hub ${daoId}`)

    await tabA.goto(base + `/dao/${daoId}/stake`, { waitUntil: "domcontentloaded" })
    await waitQuiet(tabA, 1000)
    await shot(tabA, "10-A-stake", "Tab A stake panel")

    await tabA.goto(base + `/dao/${daoId}/treasury`, { waitUntil: "domcontentloaded" })
    await waitQuiet(tabA, 1000)
    await shot(tabA, "11-A-treasury", "Tab A treasury")

    await tabA.goto(
      base + `/dao/${daoId}/proposals/4`,
      { waitUntil: "domcontentloaded" },
    ).catch(() => {})
    await waitQuiet(tabA, 1000)
    await shot(tabA, "12-A-proposal", "Tab A proposal detail (weight path)")
  }

  await tabA.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabA, 800)
  await shot(tabA, "13-A-qr", "Tab A QR")

  // --- Tab B ---
  await connectKeypair(tabB, creds.B)
  await shot(tabB, "14-B-home", "Tab B connected home")

  await tabB.goto(base + "/discover", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabB, 1000)
  await shot(tabB, "15-B-discover", "Tab B discover")

  await tabB.goto(base + `/groups/${groupId}/join`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabB, 1000)
  await shot(tabB, "16-B-join", `Tab B join wall group ${groupId}`)
  const pay = tabB.getByRole("button", { name: /Pay and join/i })
  if (await pay.isEnabled().catch(() => false)) {
    if (await safeClick(tabB, pay, "B join")) {
      clickPath.ok.push("B join")
      await waitQuiet(tabB, 8000)
      await shot(tabB, "17-B-join-result", "Tab B after join")
    }
  } else {
    note("B join CTA disabled (already member or gate)")
    clickPath.ok.push("B join skipped-already-member")
    await shot(tabB, "17-B-join-already", "Tab B already member / blocked")
  }

  await tabB.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabB, 1200)
  await shot(tabB, "18-B-chat", "Tab B chat")
  const bComposer = tabB.getByPlaceholder(/Write a public message/i)
  if (await bComposer.isVisible().catch(() => false)) {
    await bComposer.fill(`B mobile ping ${Date.now()}`)
    if (await safeClick(tabB, tabB.getByRole("button", { name: /^Send$/i }), "B send")) {
      clickPath.ok.push("B send")
      await waitQuiet(tabB, 4000)
      await shot(tabB, "19-B-chat-sent", "Tab B after send")
    }
  }

  if (daoId) {
    await tabB.goto(base + `/dao/${daoId}/stake`, { waitUntil: "domcontentloaded" })
    await waitQuiet(tabB, 1000)
    await shot(tabB, "20-B-stake", "Tab B stake (zero-weight path context)")
    await tabB.goto(base + `/dao/${daoId}/proposals/4`, { waitUntil: "domcontentloaded" })
    await waitQuiet(tabB, 1000)
    await shot(tabB, "21-B-proposal", "Tab B proposal (may show zero weight)")
  }

  await tabB.goto(base + `/groups/${groupId}`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabB, 1000)
  // open roster if present for tip
  const roster = tabB.getByRole("button", { name: /Roster/i })
  if (await roster.isVisible().catch(() => false)) {
    await safeClick(tabB, roster, "B roster")
    await waitQuiet(tabB, 600)
  }
  await shot(tabB, "22-B-roster-tip", "Tab B roster / tip affordance")

  // --- Tab C ---
  await connectKeypair(tabC, creds.C)
  await shot(tabC, "23-C-home", "Tab C connected home")

  await tabC.goto(base + `/groups/${groupId}/join`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabC, 1000)
  await shot(tabC, "24-C-join", `Tab C join same group ${groupId}`)
  const payC = tabC.getByRole("button", { name: /Pay and join/i })
  if (await payC.isEnabled().catch(() => false)) {
    if (await safeClick(tabC, payC, "C join")) {
      clickPath.ok.push("C join")
      await waitQuiet(tabC, 10000)
      await shot(tabC, "25-C-join-result", "Tab C after join")
    }
  } else {
    note("C join CTA disabled")
    clickPath.fail.push("C join disabled")
    await shot(tabC, "25-C-join-blocked", "Tab C join blocked")
  }

  await tabC.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabC, 1500)
  await shot(tabC, "26-C-chat", "Tab C chat (should see A/B messages if member)")
  const cComposer = tabC.getByPlaceholder(/Write a public message/i)
  if (await cComposer.isVisible().catch(() => false)) {
    await cComposer.fill(`C mobile here ${Date.now()}`)
    if (await safeClick(tabC, tabC.getByRole("button", { name: /^Send$/i }), "C send")) {
      clickPath.ok.push("C send")
      await waitQuiet(tabC, 4000)
      await shot(tabC, "27-C-chat-sent", "Tab C after send")
    }
  } else {
    await shot(tabC, "27-C-chat-no-composer", "Tab C chat without send (not member)")
  }

  await tabC.goto(base + "/inbox", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabC, 1000)
  await shot(tabC, "28-C-inbox", "Tab C inbox")

  await tabC.goto(base + "/me/qr", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabC, 800)
  await shot(tabC, "29-C-qr", "Tab C QR")

  await tabC.goto(base + "/demo", { waitUntil: "domcontentloaded" })
  await waitQuiet(tabC, 800)
  await shot(tabC, "30-C-demo-rail", "Tab C demo story rail on phone")

  // Disconnected chat CTA check on a fresh context
  const ctxX = await browser.newContext({ ...phone })
  const tabX = await ctxX.newPage()
  await tabX.goto(base + `/groups/${groupId}/chat`, { waitUntil: "domcontentloaded" })
  await waitQuiet(tabX, 1000)
  await shot(tabX, "31-X-chat-disconnected", "Disconnected chat shows Connect CTA")
  await ctxX.close()

} finally {
  await browser.close()
}

const shots = fs.readdirSync(out).filter((f) => f.endsWith(".png")).sort()
const index = `# Mobile 3-account storyboard

Generated: ${new Date().toISOString()} (box local Asia/Shanghai)

## Accounts
- **A (owner / Tab A):** \`${creds.A.accountId}\`
- **B (member1 / Tab B):** \`${creds.B.accountId}\`
- **C (member2 / Tab C):** \`${creds.C.accountId}\`

## Group
- group_id: **${groupId}**
- fresh_create: **${fresh}**
- dao_id: **${daoId ?? "(none detected)"}**

## Viewport
- iPhone 14 profile · 390×844 · isMobile · hasTouch · deviceScaleFactor 2
- Screenshots: \`fullPage: false\` (phone frame only)

## Click path
### OK
${clickPath.ok.map((s) => `- ${s}`).join("\n") || "- (none)"}
### FAIL / blocked
${clickPath.fail.map((s) => `- ${s}`).join("\n") || "- (none)"}

## Frames (${shots.length})
${shots.map((f) => `- \`${f}\``).join("\n")}

## Log
\`\`\`
${log.join("\n")}
\`\`\`
`
fs.writeFileSync(path.join(out, "INDEX.md"), index)
console.log("\nWrote", path.join(out, "INDEX.md"), "shots=", shots.length)
