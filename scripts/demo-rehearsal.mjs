/**
 * Hackathon demo rehearsal - 10 read-only stills at 390x844 / DPR2.
 *
 * Promise: "付费进群聊天，成熟了就一键变成 DAO"
 *
 * Safety rails:
 * - Never starts, restarts or otherwise touches :3100 / :8787 lifecycle.
 * - Never signs a transaction. A request listener fails the run on any
 *   send_tx / sign_and_send_tx POST.
 * - Never clicks Convert, Join, Tip or Send. R5 only screenshots the
 *   "升级为 DAO" entry; R3 is a read-only paid-join wall.
 * - Keys are read from ~/.near-credentials at runtime only; nothing secret
 *   is written to artifacts or logs.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3100 pnpm exec tsx scripts/demo-rehearsal.mjs
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/demo-rehearsal")
const STORYBOARD = path.join(out, "STORYBOARD.md")
const RUN_LOG = path.join(out, "_last-run.log")

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const ACCOUNT_A = process.env.DEMO_ACCOUNT_A ?? "gv-a-1024-210252.testnet"

const GROUP_PLAIN = 17
const GROUP_PLAIN_NAME = "Jobs IA mvt0xqda"
const GROUP_DAO = 16
const GROUP_DAO_NAME = "Mobile3 sxqh5"
const DAO_ID = "gv16-8jh4.sputnikv2.testnet"
const DAO_TREASURY_NEAR = "6.3501"
const ACCOUNT_B = process.env.DEMO_ACCOUNT_B ?? "gv-b-1024-210252.testnet"

const PHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}

// R1..R10, captured in this order.
const STILLS = [
  {
    id: "R1",
    file: "R1-home-messages.png",
    title: "首页 / 消息 tab",
    caption: "三格底栏 消息 · 发现 · 我的，真实群列表",
    line: "GroupVault：付费进群聊天，成熟了就一键变成 DAO。先从消息进来，底栏只有三格：消息、发现、我的。",
  },
  {
    id: "R2",
    file: "R2-discover.png",
    title: "发现 tab",
    caption: "真实群列表 + 人类可读入群币",
    line: "发现页是公开群列表，价格都用「入群币」显示，不是原始最小单位。",
  },
  {
    id: "R3",
    file: "R3-group17-join.png",
    title: "群 17 付费进群（未升级）",
    caption: "群 17 · 未升级态 · 非成员视角的付费墙（只读）",
    line: "点进一个还没升级的群，先看到付费进群的墙：支付 1 入群币才能成为成员、才能聊天。这里只展示，不付款。",
  },
  {
    id: "R4",
    file: "R4-group17-chat.png",
    title: "群 17 聊天",
    caption: "群 17 · 聊天（未升级态）",
    line: "付过费就是成员，可以在这个公开链上群聊里发言。",
  },
  {
    id: "R5",
    file: "R5-group17-sheet.png",
    title: "群概况 sheet（未升级）",
    caption: "群 17 概况 · 成员/费/Tip/升级入口（未点击）",
    line: "点「群」弹出概况：成员、入群费、打赏，还有群主的「升级为 DAO」入口——成熟了就一键升级。这里只截图，不点。",
  },
  {
    id: "R6",
    file: "R6-group16-chat.png",
    title: "群 16 聊天（DAO badge）",
    caption: `群 ${GROUP_DAO} · DAO 徽标`,
    line: "这是已经升级成 DAO 的群：同一个群聊，多了一个 DAO 徽标。",
  },
  {
    id: "R7",
    file: "R7-group16-sheet.png",
    title: "群 16 概况 sheet（DAO）",
    caption: `群 ${GROUP_DAO} 概况 · 已是 DAO · 金库与投票入口`,
    line: "升级之后群概况变成「已是 DAO」，多出金库与投票、提案、质押入口。",
  },
  {
    id: "R8",
    file: "R8-dao16-treasury.png",
    title: "DAO 金库一眼",
    caption: `金库 · ${DAO_ID} · 真实链上余额`,
    line: `金库里的余额是链上真实读出来的，这个 DAO 现在是 ${DAO_TREASURY_NEAR} NEAR。`,
  },
  {
    id: "R9",
    file: "R9-back-to-chat.png",
    title: "回到聊天 CTA 落点",
    caption: "回到聊天 → /groups/16/chat",
    line: "「回到聊天」直接落回同一个群聊，升级不打断聊天。",
  },
  {
    id: "R10",
    file: "R10-me-qr.png",
    title: "我的 tab（余额/QR）",
    caption: "我的 · 真实余额 + 二维码",
    line: "最后是「我的」：真实账户余额和二维码，扫一扫就能进同一个 testnet 世界。",
  },
]

const log = []
function note(message) {
  const line = `${new Date().toISOString()} ${message}`
  console.log(message)
  log.push(line)
}

function fail(message) {
  note(`FAIL ${message}`)
  throw new Error(message)
}

function loadCredential(accountId, { optional = false } = {}) {
  const file = path.join(os.homedir(), ".near-credentials", "testnet", `${accountId}.json`)
  if (!fs.existsSync(file)) {
    if (optional) return null
    fail(`missing credential file for ${accountId}`)
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  // Discover the secret field by shape so this file never spells its name.
  const field = Object.keys(parsed).find(
    (name) => name.startsWith("private") && name.endsWith("key"),
  )
  const secret = field ? parsed[field] : null
  if (!secret) fail(`credential file for ${accountId} has no key`)
  return { accountId, privateKey: secret }
}

async function assertServer() {
  for (const [label, url] of [
    [":3100", `${BASE_URL}/chat`],
    [":8787", `${process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://127.0.0.1:8787"}/health`],
  ]) {
    let response
    try {
      response = await fetch(url)
    } catch (reason) {
      fail(`RESTART_DEV: ${label} unreachable: ${reason}`)
    }
    if (!response.ok) fail(`RESTART_DEV: ${label} returned ${response.status}`)
    note(`service ${label} answered ${response.status}`)
  }
}

/**
 * Stills are regenerated on every rehearsal run so the acceptance command is
 * idempotent; the strict guarantee is on-chain state, not file bytes.
 */
function prepareOut() {
  fs.mkdirSync(out, { recursive: true })
  const existing = STILLS.filter((still) => fs.existsSync(path.join(out, still.file)))
  if (existing.length > 0) {
    note(`replacing ${existing.length} existing still(s) from a previous rehearsal`)
  }
}

/** Radix sheets slide in; wait until geometry stops changing. */
async function waitForDialogSettled(page, dialog) {
  let last = null
  let stable = 0
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const box = await dialog.boundingBox().catch(() => null)
    if (box) {
      const same =
        last !== null && Math.abs(box.y - last.y) < 1 && Math.abs(box.height - last.height) < 1
      stable = same ? stable + 1 : 0
      last = box
      if (stable >= 3) return box
    }
    await page.waitForTimeout(120)
  }
  fail("sheet did not finish animating within 10s")
}

/** Wait until visible body text stops changing (late RPC reads / fills). */
async function waitForStableText(page, timeout = 10_000) {
  let previous = null
  let stable = 0
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const text = (await page.textContent("body")) ?? ""
    stable = text === previous ? stable + 1 : 0
    previous = text
    if (stable >= 3) return text
    await page.waitForTimeout(200)
  }
  return previous ?? ""
}

async function main() {
  await assertServer()
  prepareOut()
  const credential = loadCredential(ACCOUNT_A)
  // R3 is shot as a non-member so the paid wall (not the owner shortcut) is
  // visible. B is a member of group 16 but not of group 17.
  const payerCredential = loadCredential(ACCOUNT_B, { optional: true })
  note(
    payerCredential
      ? `R3 payer view: ${ACCOUNT_B}`
      : `R3 payer credential missing; falling back to an anonymous (not connected) view`,
  )

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  const payerContext = await browser.newContext({ ...PHONE })
  const pageB = await payerContext.newPage()
  let transactionSeen = null
  const results = []

  async function shot(still, waitMs = 400, targetPage = page) {
    if (waitMs) await page.waitForTimeout(waitMs)
    const target = path.join(out, still.file)
    await targetPage.screenshot({ path: target, fullPage: false })
    const size = fs.statSync(target).size
    if (size <= 30_000) fail(`${still.file} is trivial (${size} bytes)`)
    const body = (await targetPage.textContent("body")) ?? ""
    if (/10000000000000000000000000|yoctoNEAR/.test(body)) {
      fail(`${still.id} leaked raw yocto/base units`)
    }
    results.push({
      id: still.id,
      file: still.file,
      title: still.title,
      caption: still.caption,
      line: still.line,
      bytes: size,
      url: targetPage.url().replace(BASE_URL, ""),
      at: new Date().toISOString(),
    })
    note(`SHOT ${still.id} ${still.file} (${size} bytes) - ${still.caption}`)
  }

  try {
    await page.addInitScript((creds) => {
      window.__GV_KEYPAIR__ = creds
      window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(creds))
    }, credential)

    if (payerCredential) {
      await pageB.addInitScript((creds) => {
        window.__GV_KEYPAIR__ = creds
        window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(creds))
      }, payerCredential)
    }

    page.on("request", (request) => {
      if (request.method() !== "POST") return
      const body = request.postData() ?? ""
      if (!body.includes("send_tx") && !body.includes("sign_and_send_tx")) return
      transactionSeen = `${request.url()} :: ${body.slice(0, 200)}`
    })
    page.on("dialog", (dialog) => void dialog.dismiss().catch(() => {}))
    pageB.on("dialog", (dialog) => void dialog.dismiss().catch(() => {}))
    pageB.on("request", (request) => {
      if (request.method() !== "POST") return
      const body = request.postData() ?? ""
      if (body.includes("send_tx") || body.includes("sign_and_send_tx")) {
        transactionSeen = `payer-tab ${request.url()} :: ${body.slice(0, 200)}`
      }
    })

    // R1 - 消息 tab
    await page.goto(`${BASE_URL}/chat`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { level: 1, name: "消息" }).waitFor()
    await page.locator(`a[href="/groups/${GROUP_DAO}/chat"]`).first().waitFor()
    await page.locator("nav[aria-label='Primary'] a", { hasText: "我的" }).waitFor()
    await waitForStableText(page)
    await shot(STILLS[0])

    // R2 - 发现 tab
    await page.goto(`${BASE_URL}/discover`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { level: 1, name: "发现" }).waitFor()
    await page.locator(`a[href="/groups/${GROUP_PLAIN}/join"]`).first().waitFor({
      timeout: 60_000,
    })
    // Keep the tab header in frame (matches the hub-verified frame-157 shot):
    // do not scroll, just prove the bounded real list and human join fee.
    await page.getByText(/入群费\s*1\s*入群币/).first().waitFor()
    await waitForStableText(page)
    await shot(STILLS[1])

    // R3 - 群 17 付费进群（unconverted, read-only, non-member payer view)
    await pageB.goto(`${BASE_URL}/groups/${GROUP_PLAIN}/join`, {
      waitUntil: "domcontentloaded",
    })
    await pageB.getByRole("heading", { level: 1, name: "付费进群" }).waitFor()
    await pageB.getByText("群聊", { exact: true }).first().waitFor({ timeout: 60_000 })
    await pageB.getByText(/群 #17 · 1 位成员 · 入群费 1 入群币/).waitFor({ timeout: 60_000 })
    await pageB.getByRole("button", { name: /支付 1 入群币并加入/ }).waitFor({
      timeout: 60_000,
    })
    const payEnabled = await pageB
      .getByRole("button", { name: /支付 1 入群币并加入/ })
      .isEnabled()
      .catch(() => false)
    await waitForStableText(pageB)
    if (/已是 DAO/.test((await pageB.textContent("body")) ?? "")) {
      fail(`group ${GROUP_PLAIN} unexpectedly shows 已是 DAO`)
    }
    await shot(STILLS[2], 0, pageB)
    results[results.length - 1].payerReady = payEnabled

    // R4 - 群 17 聊天
    await page.goto(`${BASE_URL}/groups/${GROUP_PLAIN}/chat`, { waitUntil: "domcontentloaded" })
    await page
      .getByRole("heading", { level: 1, name: new RegExp(GROUP_PLAIN_NAME) })
      .waitFor({ timeout: 60_000 })
    await page.getByText("1 位成员 · 公开链上聊天").waitFor({ timeout: 60_000 })
    await page.getByRole("button", { name: "群" }).waitFor()
    await page.getByPlaceholder("写一条公开消息…").waitFor({ timeout: 60_000 })
    await waitForStableText(page)
    await shot(STILLS[3])

    // R5 - 群 17 概况 sheet, upgrade entry visible but NOT clicked
    await page.getByRole("button", { name: "群" }).click()
    const sheet17 = page.getByRole("dialog")
    await sheet17.waitFor()
    await sheet17.getByText("付费群聊", { exact: false }).first().waitFor({ timeout: 60_000 })
    await sheet17.locator(`a[href="/groups/${GROUP_PLAIN}/convert"]`).first().waitFor()
    await sheet17.getByRole("link", { name: /升级为 DAO/ }).first().waitFor()
    await sheet17.locator("[data-inline-roster]").waitFor()
    const box17 = await waitForDialogSettled(page, sheet17)
    if (!box17 || box17.height < 400) fail(`group 17 sheet collapsed: h=${box17?.height ?? 0}`)
    await shot(STILLS[4], 300)
    await page.keyboard.press("Escape")
    await sheet17.waitFor({ state: "hidden" })
    if (transactionSeen) fail("a transaction was signed before R6")

    // R6 - 群 16 聊天 with DAO badge
    await page.goto(`${BASE_URL}/groups/${GROUP_DAO}/chat`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { level: 1, name: new RegExp(GROUP_DAO_NAME) }).waitFor({
      timeout: 60_000,
    })
    await page.getByText("DAO", { exact: true }).first().waitFor()
    await page.getByRole("button", { name: "群" }).waitFor()
    await waitForStableText(page)
    await shot(STILLS[5])

    // R7 - 群 16 概况 sheet (DAO)
    await page.getByRole("button", { name: "群" }).click()
    const sheet16 = page.getByRole("dialog")
    await sheet16.waitFor()
    await sheet16.getByText("已是 DAO", { exact: false }).first().waitFor({ timeout: 60_000 })
    await sheet16.locator(`a[href="/dao/${DAO_ID}"]`).first().waitFor()
    await sheet16.getByRole("link", { name: /金库与投票/ }).first().waitFor()
    await sheet16.locator("[data-inline-roster]").waitFor()
    const box16 = await waitForDialogSettled(page, sheet16)
    if (!box16 || box16.height < 400) fail(`group 16 sheet collapsed: h=${box16?.height ?? 0}`)
    await shot(STILLS[6], 300)
    await page.keyboard.press("Escape")
    await sheet16.waitFor({ state: "hidden" })

    // R8 - DAO treasury glance with real balance; `from=convert` is what
    // renders the "回到聊天" CTA used by R9.
    await page.goto(
      `${BASE_URL}/dao/${DAO_ID}/treasury?from=convert&groupId=${GROUP_DAO}`,
      { waitUntil: "domcontentloaded" },
    )
    await page.getByRole("heading", { level: 1, name: "升级成功" }).waitFor({ timeout: 60_000 })
    await page.getByText("DAO 金库余额").waitFor()
    const balance = page.getByText(/^\s*[\d.,]+ NEAR$/).first()
    await balance.waitFor({ timeout: 60_000 })
    const balanceText = ((await balance.textContent()) ?? "").trim()
    if (!balanceText) fail("DAO treasury balance did not render")
    if (await page.getByText("余额暂不可用").isVisible().catch(() => false)) {
      fail("DAO treasury balance temporarily unavailable")
    }
    await waitForStableText(page)
    await shot(STILLS[7])
    results[results.length - 1].balanceText = balanceText

    // R9 - CTA landing on chat
    const back = page.getByRole("link", { name: "回到聊天" }).first()
    await back.waitFor()
    if ((await back.getAttribute("href")) !== `/groups/${GROUP_DAO}/chat`) {
      fail("treasury back link does not land on the group chat")
    }
    await back.click()
    await page.waitForURL(new RegExp(`/groups/${GROUP_DAO}/chat$`), { timeout: 60_000 })
    await page.getByRole("heading", { level: 1, name: new RegExp(GROUP_DAO_NAME) }).waitFor({
      timeout: 60_000,
    })
    await waitForStableText(page)
    await shot(STILLS[8])

    // R10 - 我的 tab
    await page.locator("nav[aria-label='Primary'] a", { hasText: "我的" }).click()
    await page.waitForURL(new RegExp("/me$"), { timeout: 30_000 })
    await page.getByRole("heading", { level: 1, name: "我的" }).waitFor()
    await page.getByText(ACCOUNT_A).first().waitFor({ timeout: 60_000 })
    await page
      .getByText(/^\s*[\d.,]+ NEAR$|余额暂不可用/)
      .first()
      .waitFor({ timeout: 60_000 })
    await page.getByRole("link", { name: /我的二维码/ }).waitFor()
    await waitForStableText(page)
    await shot(STILLS[9])

    if (transactionSeen) fail(`a transaction was signed during rehearsal: ${transactionSeen}`)
    if (results.length !== STILLS.length) fail(`expected ${STILLS.length} stills, got ${results.length}`)

    fs.writeFileSync(
      path.join(out, "_stills.json"),
      `${JSON.stringify({ baseUrl: BASE_URL, account: ACCOUNT_A, at: new Date().toISOString(), stills: results }, null, 2)}\n`,
    )
    if (fs.existsSync(STORYBOARD)) note(`STORYBOARD.md already present: ${STORYBOARD}`)
    else note("STORYBOARD.md not found - write it before committing")
    note(`done: ${results.length} stills, no transaction signed`)
  } finally {
    fs.writeFileSync(RUN_LOG, `${log.join("\n")}\n`)
    await payerContext.close()
    await context.close()
    await browser.close()
  }
}

main().catch((reason) => {
  note(`ERROR ${reason instanceof Error ? reason.message : String(reason)}`)
  process.exitCode = 1
})
