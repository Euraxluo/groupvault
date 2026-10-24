import { expect, test } from "./fixtures"

test("E2E points at the GroupVault app, not another local service", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { level: 1, name: /A group chat with a treasury/i }),
  ).toBeVisible()
  await expect(page.getByText(/GroupVault/i).first()).toBeVisible()
  await expect(page.getByText(/is not configured/i)).toHaveCount(0)
})
