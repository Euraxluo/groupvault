import { expect, test } from "@playwright/test"

test("home page serves the GroupVault shell", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: /Paid group → chat → Convert → stake/i }),
  ).toBeVisible()
  await expect(page.getByText(/No backend signing/i)).toBeVisible()
  await expect(page.getByText(/Public on-chain logs/i)).toBeVisible()
})
