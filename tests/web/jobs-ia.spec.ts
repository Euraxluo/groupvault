import { expect, test } from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

test.use({ viewport: { width: 390, height: 844 } })

const RAW_YOCTO = "10000000000000000000000000"
const ACCOUNT_A = process.env.DEMO_ACCOUNT_A ?? ""
const KEYPAIR_MODE = process.env.DEMO_KEYPAIR_MODE === "1"

function readAKeypair(): { accountId: string; privateKey: string } | null {
  if (!KEYPAIR_MODE || !ACCOUNT_A) return null
  const file = path.join(
    os.homedir(),
    ".near-credentials",
    "testnet",
    `${ACCOUNT_A}.json`,
  )
  if (!fs.existsSync(file)) return null
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
    private_key?: string
  }
  if (!parsed.private_key) return null
  return { accountId: ACCOUNT_A, privateKey: parsed.private_key }
}

test("discover group 16 reaches the paid wall without signing", async ({ page }) => {
  await page.goto("/discover")

  const row = page.locator('a[href="/groups/16/join"]')
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect(row).toContainText("1 入群币")
  await expect(page.locator("body")).not.toContainText("1000000 base units")

  await expect(row).toHaveAttribute("href", "/groups/16/join")
  await row.click()
  await expect(page).toHaveURL(/\/groups\/16\/join$/, { timeout: 30_000 })
  await expect(
    page.getByRole("heading", { level: 1, name: "付费进群" }),
  ).toBeVisible()
  await expect(page.getByText("1 入群币").first()).toBeVisible()
  await expect(page.locator("body")).not.toContainText("base units")
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)
})

test("join page keeps an honest wallet boundary and a chat route", async ({ page }) => {
  await page.goto("/groups/16/join")

  await expect(
    page.getByRole("heading", { level: 1, name: "付费进群" }),
  ).toBeVisible()
  await expect(page.getByText(/付费不等于投票权重/)).toBeVisible()

  // Either the wallet sees a confirmed membership with a chat entry, or it is
  // told to connect/pay. Never a fabricated success state.
  const chatLink = page.getByRole("link", { name: "进入群聊" })
  const payButton = page.getByRole("button", { name: /入群币并加入/ })
  const ownerNote = page.getByText(/群主已是成员/)
  await expect(chatLink.or(payButton).or(ownerNote).first()).toBeVisible({
    timeout: 30_000,
  })

  if (await chatLink.isVisible()) {
    await expect(chatLink).toHaveAttribute("href", "/groups/16/chat")
    await chatLink.click()
    await expect(page).toHaveURL(/\/groups\/16\/chat$/)
  } else {
    await expect(page.getByText(/先连接钱包|入群费/).first()).toBeVisible()
  }
})

test("discover exposes no raw amounts and a single paid entry", async ({ page }) => {
  await page.goto("/discover")

  await expect(page.getByRole("heading", { level: 1, name: "发现" })).toBeVisible()
  await expect(page.locator('a[href="/groups/16/chat"]')).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)
  await expect(page.locator("body")).not.toContainText("yoctoNEAR")
  await expect(page.locator("body")).not.toContainText("base units")
})

test("group 16 chat opens the real sheet with DAO state", async ({ page }) => {
  await page.goto("/groups/16/chat")

  await expect(page.getByRole("heading", { level: 1, name: /Mobile3 sxqh5/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "群" })).toBeVisible()
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)

  const privacy = page.locator("[data-privacy-notice]")
  await expect(privacy).toBeVisible()
  await privacy.click()
  await expect(page.getByText(/任何人都能读取/)).toBeVisible()
  await expect(page.getByText(/没有端到端加密/)).toBeVisible()
  await privacy.click()

  await page.getByRole("button", { name: "群" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText("已是 DAO")).toBeVisible()
  await expect(sheet.getByText("1 入群币", { exact: true })).toBeVisible()
  await expect(sheet.getByRole("link", { name: /金库与投票/ })).toHaveAttribute(
    "href",
    "/dao/gv16-8jh4.sputnikv2.testnet",
  )
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)
})

test("group 16 sheet keeps A self disabled and B/C tips visible (no spend)", async ({
  page,
}) => {
  const creds = readAKeypair()
  test.skip(!creds, "DEMO_ACCOUNT_A + DEMO_KEYPAIR_MODE=1 with local credentials required")
  if (!creds) return

  // Runtime-only session injection: never persisted to source or artifacts.
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(session))
  }, creds)

  await page.goto("/groups/16/chat")
  await expect(page.getByRole("button", { name: "群" })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "群" }).click()

  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText("已是 DAO")).toBeVisible()

  // A is a group member: own tip is the disabled 自己 control.
  const self = sheet.locator(`[data-tip-receiver="${ACCOUNT_A}"]`)
  await expect(self).toBeVisible()
  await expect(self.getByRole("button")).toBeDisabled()
  await expect(self.getByRole("button")).toHaveText("自己")

  // B and C remain tippable; this gate never clicks them.
  const tipButtons = sheet.getByRole("button", { name: /^Tip / })
  await expect(tipButtons.first()).toBeVisible()
  expect(await tipButtons.count()).toBeGreaterThanOrEqual(2)
  for (let index = 0; index < (await tipButtons.count()); index += 1) {
    await expect(tipButtons.nth(index)).toContainText("打赏")
    await expect(tipButtons.nth(index)).toBeEnabled()
  }

  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)
})

test("unconverted group shows the real 10 NEAR confirmation without spending", async ({
  page,
}) => {
  // Group 11 is A-owned and has no DAO; this gate reads the confirmation only
  // and never signs Convert.
  await page.goto("/groups/11/convert", { waitUntil: "domcontentloaded" })

  await expect(
    page.getByRole("heading", { level: 1, name: "升级为 DAO" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/约 10 NEAR/)).toBeVisible()
  const confirm = page.getByRole("button", { name: "确认升级" })
  await expect(confirm).toBeVisible()
  await expect(confirm).toBeDisabled()
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)
  await expect(page.locator("body")).not.toContainText("yoctoNEAR")
  await expect(page.getByText(/已是 DAO/)).toHaveCount(0)
})

test("converted treasury glance shows real DAO state and returns to chat", async ({
  page,
}) => {
  await page.goto(
    "/dao/gv16-8jh4.sputnikv2.testnet/treasury?from=convert&groupId=16",
    { waitUntil: "domcontentloaded" },
  )

  await expect(
    page.getByRole("heading", { level: 1, name: "升级成功" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("DAO 金库余额")).toBeVisible()
  await expect(page.getByText(/正在读取链上余额|NEAR|余额暂不可用/).first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator("body")).not.toContainText(RAW_YOCTO)

  const back = page.getByRole("link", { name: "回到聊天" }).first()
  await expect(back).toHaveAttribute("href", "/groups/16/chat")
  await back.click()
  await expect(page).toHaveURL(/\/groups\/16\/chat$/)
})
