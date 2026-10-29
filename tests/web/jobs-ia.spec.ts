import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

const RAW_YOCTO = "10000000000000000000000000"

test("discover group 16 reaches the paid wall without signing", async ({ page }) => {
  await page.goto("/discover")

  const row = page.locator('a[href="/groups/16/join"]')
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 入群币")
  await expect(page.locator("body")).not.toContainText("1000000 base units")

  await Promise.all([
    page.waitForURL(/\/groups\/16\/join$/, { timeout: 15_000 }),
    row.click(),
  ])
  await expect(page).toHaveURL(/\/groups\/16\/join$/)
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
