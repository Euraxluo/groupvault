/**
 * Jobs Mobile IA Hub QA - frames 156-162 at 390x844 on the live demo.
 *
 * Safety rails:
 * - Never starts or restarts the dev server; requires :3100 to answer.
 * - Never signs Convert or Tip. Frame 160 only screenshots the confirmation.
 * - Refuses to overwrite existing frame numbers or files.
 * - Verifies frames 153-155 and records their SHA-256 before writing.
 * - Keys are read from ~/.near-credentials at runtime only; nothing secret is
 *   written to artifacts or logs.
 *
 * Usage:
 *   START_FRAME=156 STOP_FRAME=159 BASE_URL=http://127.0.0.1:3100 \
 *     pnpm exec tsx scripts/jobs-mobile-ia-hub-qa.mjs
 */
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const out = path.join(root, "artifacts/hub-qa/mobile-3acct")
const evidencePath = path.join(out, "_last-chain.json")

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const START_FRAME = Number(process.env.START_FRAME ?? "156")
const STOP_FRAME = Number(process.env.STOP_FRAME ?? "162")
const QA_CONVERT_GROUP_ID = process.env.QA_CONVERT_GROUP_ID
  ? Number(process.env.QA_CONVERT_GROUP_ID)
  : null
const LIST_ONLY = process.env.QA_LIST_ONLY === "1"

const GROUP_ID = 16
const DAO_ID = "gv16-8jh4.sputnikv2.testnet"
const ACCOUNT_A = process.env.DEMO_ACCOUNT_A ?? "gv-a-1024-210252.testnet"
const CONTRACT =
  process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ??
  "gv-deployer-1024-204559-groupvault.testnet"
const RPC_URLS = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_NEAR_RPC_URL,
      "https://testnet-rpc.intea.rs",
      "https://rpc.testnet.fastnear.com",
    ].filter(Boolean),
  ),
)

const PHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}

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

function readChain() {
  if (!fs.existsSync(evidencePath)) fail(`missing ${evidencePath}`)
  return JSON.parse(fs.readFileSync(evidencePath, "utf8"))
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

const PROTECTED_FRAMES = [
  "153-A-g16-details-tip-visible.png",
  "154-A-tip-after-click.png",
  "155-A-roster-full-tip.png",
]

async function rpc(method, params) {
  let lastError
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "jobs-ia-qa", method, params }),
      })
      if (!response.ok) {
        lastError = new Error(`${url} HTTP ${response.status}`)
        continue
      }
      const body = await response.json()
      if (body.error) {
        lastError = new Error(`${url} ${body.error.message ?? "rpc error"}`)
        continue
      }
      return body.result
    } catch (reason) {
      lastError = reason
    }
  }
  throw lastError ?? new Error(`RPC ${method} failed`)
}

async function view(contractId, methodName, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
  })
  const text = Buffer.from(result.result ?? []).toString("utf8")
  return text ? JSON.parse(text) : null
}

function loadCredential(accountId) {
  const file = path.join(
    os.homedir(),
    ".near-credentials",
    "testnet",
    `${accountId}.json`,
  )
  if (!fs.existsSync(file)) fail(`missing credential file for ${accountId}`)
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  if (!parsed.private_key) fail(`credential file for ${accountId} has no key`)
  return { accountId, privateKey: parsed.private_key }
}

async function assertFixture() {
  const group = await view(CONTRACT, "get_group", { group_id: GROUP_ID })
  if (!group) fail(`group ${GROUP_ID} not readable`)
  if (group.dao_id !== DAO_ID) {
    fail(`group ${GROUP_ID} dao mismatch: ${group.dao_id} != ${DAO_ID}`)
  }
  return group
}

/**
 * Frame-160 fixture: A-owned, no DAO, no pending conversion. Never group 16.
 */
async function selectConvertFixture() {
  if (QA_CONVERT_GROUP_ID !== null) {
    if (!Number.isSafeInteger(QA_CONVERT_GROUP_ID) || QA_CONVERT_GROUP_ID < 0) {
      fail("QA_CONVERT_GROUP_ID must be a non-negative integer")
    }
    if (QA_CONVERT_GROUP_ID === GROUP_ID) {
      fail(`QA_CONVERT_GROUP_ID must not be group ${GROUP_ID} (already a DAO)`)
    }
    const group = await view(CONTRACT, "get_group", {
      group_id: QA_CONVERT_GROUP_ID,
    })
    if (!group) fail(`QA_CONVERT_GROUP_ID=${QA_CONVERT_GROUP_ID} not found`)
    if (group.owner !== ACCOUNT_A) {
      fail(`fixture owner ${group.owner} is not ${ACCOUNT_A}`)
    }
    if (group.dao_id) fail(`fixture group ${group.id} already has DAO ${group.dao_id}`)
    if (group.convert_pending) fail(`fixture group ${group.id} has a pending convert`)
    return group
  }

  const groups = await view(CONTRACT, "get_groups", { from_index: 0, limit: 50 })
  const candidates = (groups ?? [])
    .filter(
      (group) =>
        group.owner === ACCOUNT_A &&
        !group.dao_id &&
        !group.convert_pending &&
        group.id !== GROUP_ID,
    )
    .sort((left, right) => right.id - left.id)
  if (candidates.length === 0) {
    fail(
      "no A-owned unconverted group; create one through the normal /groups/new flow and pass QA_CONVERT_GROUP_ID",
    )
  }
  return candidates[0]
}

function validateEvidenceWindow(chain) {
  if (!Array.isArray(chain.frames)) fail("_last-chain.json has no frames array")
  const seen = new Set()
  for (const frame of chain.frames) {
    // Older rows (74-152) use `name: "74-A-home"` instead of `n`.
    const raw =
      typeof frame.n === "number"
        ? frame.n
        : Number(String(frame.name ?? frame.file ?? "").slice(0, 3))
    if (!Number.isSafeInteger(raw)) continue
    if (seen.has(raw)) fail(`duplicate frame number ${raw} in evidence`)
    seen.add(raw)
  }

  const existingFrames = fs
    .readdirSync(out)
    .filter((name) => /^\d{3}-.+\.png$/.test(name))
    .map((name) => Number(name.slice(0, 3)))
  for (const entry of existingFrames) {
    if (!seen.has(entry)) fail(`PNG frame ${entry} exists without an evidence row`)
  }

  const files = fs.readdirSync(out)
  for (let frame = START_FRAME; frame <= STOP_FRAME; frame += 1) {
    if (seen.has(frame)) fail(`frame ${frame} already in evidence`)
    const file = files.find((name) =>
      name.startsWith(`${String(frame).padStart(3, "0")}-`),
    )
    if (file) fail(`frame file already exists: ${file}`)
  }

  if (START_FRAME !== 156) {
    if (chain.nextFrame !== START_FRAME) {
      fail(
        `non-contiguous segment: evidence nextFrame=${chain.nextFrame} but START_FRAME=${START_FRAME}`,
      )
    }
  } else if (chain.nextFrame !== 156) {
    fail(`expected evidence nextFrame=156 before this run, found ${chain.nextFrame}`)
  }
}

async function hashes() {
  const result = {}
  for (const name of PROTECTED_FRAMES) {
    const file = path.join(out, name)
    if (!fs.existsSync(file)) fail(`missing protected frame ${name}`)
    if (fs.statSync(file).size === 0) fail(`protected frame ${name} is empty`)
    result[name] = sha256(file)
  }
  const values = Object.values(result)
  if (values.every((value) => value === values[0])) {
    fail("protected frames 153-155 have identical hashes; evidence looks wrong")
  }
  return result
}

async function assertServer() {
  let response
  try {
    response = await fetch(`${BASE_URL}/chat`, { redirect: "follow" })
  } catch (reason) {
    fail(`RESTART_DEV: ${BASE_URL}/chat unreachable: ${reason}`)
  }
  if (!response.ok) fail(`RESTART_DEV: ${BASE_URL}/chat returned ${response.status}`)
  note(`server ${BASE_URL} answered ${response.status}`)
}

async function main() {
  if (!Number.isSafeInteger(START_FRAME) || !Number.isSafeInteger(STOP_FRAME)) {
    fail("START_FRAME/STOP_FRAME must be integers")
  }
  if (STOP_FRAME < START_FRAME) fail("STOP_FRAME must be >= START_FRAME")
  if (START_FRAME < 156) fail("this driver only writes frames 156+")
  if (STOP_FRAME > 162) fail("this driver only writes frames up to 162")
  if (START_FRAME <= 159 && STOP_FRAME >= 160) {
    fail("frames 159/160 span two fixtures; run separate segments")
  }

  const chain = readChain()
  validateEvidenceWindow(chain)
  const protectedHashes = await hashes()
  note(
    `protected frames recorded: ${Object.entries(protectedHashes)
      .map(([name, hash]) => `${name.slice(0, 3)}=${hash.slice(0, 12)}`)
      .join(" ")}`,
  )

  const group16 = await assertFixture()
  note(`group16 fixture ok: dao=${group16.dao_id} members=${group16.member_count}`)

  let convertFixture = null
  if (START_FRAME <= 160 && STOP_FRAME >= 160) {
    convertFixture = await selectConvertFixture()
    note(
      `convert fixture group=${convertFixture.id} owner=${convertFixture.owner} dao_id=${convertFixture.dao_id ?? "null"} pending=${convertFixture.convert_pending}`,
    )
  }

  if (LIST_ONLY) {
    const plan = []
    if (START_FRAME <= 156 && STOP_FRAME >= 156) plan.push("156-messages")
    if (START_FRAME <= 157 && STOP_FRAME >= 157) plan.push("157-discover")
    if (START_FRAME <= 158 && STOP_FRAME >= 158) plan.push("158-g16-chat")
    if (START_FRAME <= 159 && STOP_FRAME >= 159) plan.push("159-g16-sheet")
    if (START_FRAME <= 160 && STOP_FRAME >= 160) {
      plan.push(`160-convert-confirm (group ${convertFixture.id})`)
    }
    if (STOP_FRAME >= 161) plan.push("161-treasury-glance", "162-back-to-chat")
    note(`plan: ${plan.join(" -> ")}`)
    note("list-only: no screenshot written, no transaction sent")
    return
  }

  await assertServer()
  const credential = loadCredential(ACCOUNT_A)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  const steps = {}
  const newFrames = []
  let nextFrame = START_FRAME
  let transactionSent = false

  async function shot(name, caption) {
    const file = `${String(nextFrame).padStart(3, "0")}-${name}.png`
    const target = path.join(out, file)
    if (fs.existsSync(target)) fail(`refusing to overwrite ${file}`)
    await page.screenshot({ path: target, fullPage: false })
    const size = fs.statSync(target).size
    if (size === 0) fail(`${file} is empty`)
    newFrames.push({
      n: nextFrame,
      file,
      caption,
      at: new Date().toISOString(),
      width: 780,
      height: 1688,
    })
    note(`SHOT ${file} - ${caption}`)
    nextFrame += 1
  }

  try {
    await page.addInitScript((creds) => {
      window.__GV_KEYPAIR__ = creds
      window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(creds))
    }, credential)

    page.on("request", (request) => {
      if (request.method() !== "POST") return
      const body = request.postData() ?? ""
      if (!body.includes("send_tx") && !body.includes("sign_and_send_tx")) return
      if (/convert_to_dao|add_proposal|act_proposal|transfer/.test(body)) {
        transactionSent = true
      }
    })

    if (START_FRAME <= 156 && STOP_FRAME >= 156) {
      await page.goto(`${BASE_URL}/chat`, { waitUntil: "domcontentloaded" })
      await page.getByRole("heading", { level: 1, name: "消息" }).waitFor()
      await page.locator(`a[href="/groups/${GROUP_ID}/chat"]`).first().waitFor()
      const body = (await page.textContent("body")) ?? ""
      if (/1000000 base units|10000000000000000000000000|yoctoNEAR/.test(body)) {
        fail("messages frame leaked raw base units or yocto")
      }
      await shot("messages", "消息 · bounded real groups, human 入群币")
    }

    if (START_FRAME <= 157 && STOP_FRAME >= 157) {
      await page.goto(`${BASE_URL}/discover`, { waitUntil: "domcontentloaded" })
      await page.getByRole("heading", { level: 1, name: "发现" }).waitFor()
      await page.locator(`a[href="/groups/${GROUP_ID}/join"]`).first().waitFor()
      await shot("discover", "发现 · paid Join entry, human 入群币")
    }

    if (START_FRAME <= 158 && STOP_FRAME >= 158) {
      await page.goto(`${BASE_URL}/groups/${GROUP_ID}/chat`, {
        waitUntil: "domcontentloaded",
      })
      await page
        .getByRole("heading", { level: 1, name: /Mobile3 sxqh5/ })
        .waitFor({ timeout: 60_000 })
      await page.getByRole("button", { name: "群" }).waitFor()
      await shot("g16-chat", "群 16 聊天 · 群名/DAO 徽标/群入口")
    }

    if (START_FRAME <= 159 && STOP_FRAME >= 159) {
      await page.getByRole("button", { name: "群" }).click()
      const sheet = page.getByRole("dialog")
      await sheet.waitFor()
      await sheet.getByText("已是 DAO").waitFor()
      await sheet.getByText("1 入群币", { exact: true }).waitFor()
      await sheet.getByRole("link", { name: /金库与投票/ }).waitFor()

      const self = sheet.locator(`[data-tip-receiver="${ACCOUNT_A}"]`)
      await self.waitFor()
      const selfDisabled = await self.getByRole("button").isDisabled()
      const selfLabel = ((await self.getByRole("button").textContent()) ?? "").trim()
      const tipButtons = sheet.getByRole("button", { name: /^Tip / })
      const otherTips = await tipButtons.count()
      const body = (await page.textContent("body")) ?? ""
      if (/10000000000000000000000000|yoctoNEAR/.test(body)) {
        fail("sheet frame leaked raw yocto")
      }
      steps.jobsIaTipRegression = {
        selfDisabled,
        selfLabel,
        otherTips,
        transactionSent,
      }
      if (!selfDisabled) fail("self Tip control is not disabled")
      if (otherTips < 2) fail(`expected at least 2 other Tip buttons, found ${otherTips}`)
      if (transactionSent) fail("a transaction was signed during frame 159")
      await shot("g16-sheet", "群概况 · 成员/入群费/DAO/Tip（未发送交易）")
      await page.keyboard.press("Escape")
    }

    if (START_FRAME <= 160 && STOP_FRAME >= 160) {
      await page.goto(`${BASE_URL}/groups/${convertFixture.id}/convert`, {
        waitUntil: "domcontentloaded",
      })
      await page
        .getByRole("heading", { level: 1, name: "升级为 DAO" })
        .waitFor({ timeout: 60_000 })
      await page.getByText(/约 10 NEAR/).waitFor()
      const confirm = page.getByRole("button", { name: "确认升级" })
      await confirm.waitFor()
      const body = (await page.textContent("body")) ?? ""
      if (/10000000000000000000000000|yoctoNEAR/.test(body)) {
        fail("convert confirmation leaked raw yocto")
      }
      if (/已是 DAO/.test(body)) fail("fixture unexpectedly shows 已是 DAO")
      const chainGroup = await view(CONTRACT, "get_group", {
        group_id: convertFixture.id,
      })
      steps.jobsIaConvertFixture = {
        groupId: convertFixture.id,
        owner: chainGroup.owner,
        daoId: chainGroup.dao_id,
        pending: chainGroup.convert_pending,
        transactionSent,
        confirmEnabled: await confirm.isEnabled(),
      }
      if (chainGroup.owner !== ACCOUNT_A) fail("fixture owner changed mid-run")
      if (chainGroup.dao_id !== null) fail("fixture gained a DAO mid-run")
      if (chainGroup.convert_pending !== false) fail("fixture pending changed mid-run")
      if (transactionSent) fail("a transaction was signed during frame 160")
      await shot(
        "convert-confirm",
        `升级为 DAO · group ${convertFixture.id} · 约 10 NEAR（未点击）`,
      )
    }

    if (STOP_FRAME >= 161) {
      await page.goto(
        `${BASE_URL}/dao/${DAO_ID}/treasury?from=convert&groupId=${GROUP_ID}`,
        { waitUntil: "domcontentloaded" },
      )
      await page.getByRole("heading", { level: 1, name: "升级成功" }).waitFor({
        timeout: 60_000,
      })
      await page.getByText("DAO 金库余额").waitFor()
      await page
        .getByText(/正在读取链上余额|余额暂不可用|^\s*[\d.,]+ NEAR$/)
        .first()
        .waitFor({ timeout: 60_000 })

      let treasuryStatus = "PASS"
      let balanceText = null
      const rpcError = page.getByText("余额暂不可用")
      if (await rpcError.isVisible().catch(() => false)) {
        treasuryStatus = "PARTIAL"
        balanceText = (await rpcError.textContent()) ?? null
      } else {
        const balance = page.getByText(/^\s*[\d.,]+ NEAR$/)
        await balance.first().waitFor({ timeout: 60_000 }).catch(() => {})
        balanceText = (await balance.first().textContent().catch(() => null)) ?? null
        if (!balanceText) treasuryStatus = "PARTIAL"
      }
      const body = (await page.textContent("body")) ?? ""
      if (/10000000000000000000000000|yoctoNEAR/.test(body)) {
        fail("treasury frame leaked raw yocto")
      }
      const back = page.getByRole("link", { name: "回到聊天" }).first()
      await back.waitFor()
      const backHref = await back.getAttribute("href")
      if (backHref !== `/groups/${GROUP_ID}/chat`) {
        fail(`回到聊天 href mismatch: ${backHref}`)
      }
      steps.jobsIaTreasury = {
        status: treasuryStatus,
        balanceText: balanceText?.trim() ?? null,
        backHref,
        transactionSent,
      }
      await shot(
        "treasury-glance",
        `金库一眼 · ${treasuryStatus} · ${balanceText ?? "未读取"}`,
      )

      await back.click()
      await page.waitForURL(new RegExp(`/groups/${GROUP_ID}/chat$`), {
        timeout: 60_000,
      })
      const backUrl = page.url()
      if (backUrl !== `${BASE_URL}/groups/${GROUP_ID}/chat`) {
        fail(`final URL mismatch: ${backUrl}`)
      }
      steps.jobsIaTreasury.backUrl = backUrl
      await shot("back-to-chat", "回到聊天 · /groups/16/chat")
    }

    const nextChain = {
      ...chain,
      at: new Date().toISOString(),
      jobsIaAt: new Date().toISOString(),
      nextFrame,
      frames: [...chain.frames, ...newFrames],
      steps: { ...chain.steps, ...steps },
      jobsIaProtectedHashes: protectedHashes,
      jobsIaLastRun: {
        startFrame: START_FRAME,
        stopFrame: STOP_FRAME,
        convertFixture: convertFixture?.id ?? null,
        transactionSent,
      },
    }
    fs.writeFileSync(evidencePath, `${JSON.stringify(nextChain, null, 2)}\n`)
    fs.writeFileSync(path.join(out, "_jobs-ia-qa-last-run.log"), `${log.join("\n")}\n`)
    note(`wrote ${newFrames.length} frames; nextFrame=${nextFrame}`)
    if (transactionSent) fail("a transaction was signed during QA capture")
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((reason) => {
  note(`ERROR ${reason instanceof Error ? reason.message : String(reason)}`)
  process.exitCode = 1
})
