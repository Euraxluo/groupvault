import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

for (const legacy of ["/", "/groups", "/dao", "/demo"]) {
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
