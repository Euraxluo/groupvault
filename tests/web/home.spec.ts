import { expect, test } from "@playwright/test"

test("home page serves the GroupVault shell", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: /A group chat with a treasury/i }),
  ).toBeVisible()
  await expect(page.getByText(/No server-side signing/i)).toBeVisible()
  await expect(page.getByText(/No invented groups, balances, or messages/i)).toBeVisible()
})
