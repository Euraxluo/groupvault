import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

for (const legacy of ["/", "/groups", "/dao", "/demo", "/inbox"]) {
  test(`${legacy} redirects to /chat`, async ({ page }) => {
    await page.goto(legacy)
    await expect(page).toHaveURL(/\/chat$/)
  })
}

test("primary navigation has exactly three Chinese tabs", async ({ page }) => {
  await page.goto("/chat")

  const nav = page.getByRole("navigation", { name: "Primary" })
  const links = nav.getByRole("link")
  await expect(links).toHaveCount(3)
  await expect(nav).toContainText("消息")
  await expect(nav).toContainText("发现")
  await expect(nav).toContainText("我的")
  await expect(nav).not.toContainText("Groups")
  await expect(nav).not.toContainText("Chat")
  await expect(nav).not.toContainText("DAO")
  await expect(nav).not.toContainText("Inbox")
  await expect(nav).not.toContainText("Demo")

  await expect(nav.getByRole("link", { name: "消息" })).toHaveAttribute("href", "/chat")
  await expect(nav.getByRole("link", { name: "发现" })).toHaveAttribute("href", "/discover")
  await expect(nav.getByRole("link", { name: "我的" })).toHaveAttribute("href", "/me")
})

test("messages shows bounded real groups with human join fees", async ({ page }) => {
  await page.goto("/chat")

  await expect(page.getByRole("heading", { level: 1, name: "消息" })).toBeVisible()
  await expect(page.getByText(/付费进群聊天，成熟了就一键变成 DAO/).first()).toBeVisible()
  const group16 = page.locator('a[href="/groups/16/chat"]')
  await expect(group16).toBeVisible()
  await expect(group16).toContainText("入群费 1 入群币")
  await expect(page.locator("body")).not.toContainText("1000000 base units")
  await expect(page.locator("body")).not.toContainText("1000000000000000000000000")
})

test("discover opens the paid join page instead of chat", async ({ page }) => {
  await page.goto("/discover")

  await expect(page.getByRole("heading", { level: 1, name: "发现" })).toBeVisible()
  const group16 = page.locator('a[href="/groups/16/join"]')
  await expect(group16).toBeVisible()
  await expect(group16).toContainText("1 入群币")
  await group16.click()
  await expect(page).toHaveURL(/\/groups\/16\/join$/)
  await expect(page.locator("body")).not.toContainText("1000000 base units")
})

test("/me renders at phone size with wallet state and QR entry", async ({ page }) => {
  await page.goto("/me")

  await expect(page.getByRole("heading", { level: 1, name: "我的" })).toBeVisible()
  await expect(page.getByText("未连接")).toBeVisible()
  await expect(page.getByText("testnet")).toBeVisible()
  await expect(page.getByRole("link", { name: /我的二维码/ })).toHaveAttribute(
    "href",
    "/me/qr",
  )
  await expect(page.getByRole("button", { name: /连接钱包/ })).toBeVisible()

  const nav = page.getByRole("navigation", { name: "Primary" })
  await expect(nav.getByRole("link")).toHaveCount(3)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
