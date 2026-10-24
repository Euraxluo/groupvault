import type { Page } from "@playwright/test"

export const WALLET_APPROVAL_TIMEOUT_MS = 180_000

/**
 * Wait for a human to approve the wallet prompt. This never auto-approves and
 * never injects a key; a rejection or timeout fails the test.
 */
export async function waitForWalletApproval(page: Page, label: string): Promise<void> {
  console.log(`\n[wallet] Approve "${label}" in the wallet, then return to the page.\n`)
  const deadline = Date.now() + WALLET_APPROVAL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const body = (await page.textContent("body")) ?? ""
    if (/rejected|cancelled|denied/i.test(body)) {
      throw new Error(`Wallet rejected the "${label}" request`)
    }
    if (/waiting for wallet/i.test(body)) {
      await page.waitForTimeout(1000)
      continue
    }
    return
  }
  throw new Error(
    `Timed out waiting for wallet approval of "${label}". No step was marked verified.`,
  )
}

export async function connectMyNearWallet(page: Page): Promise<void> {
  await page.getByRole("button", { name: /connect/i }).first().click()
  await page.getByRole("button", { name: /Connect wallet/i }).click()

  const deadline = Date.now() + WALLET_APPROVAL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const body = (await page.textContent("body")) ?? ""
    if (/rejected|cancelled|denied/i.test(body)) {
      throw new Error("Wallet rejected the connection request")
    }
    if (/is not configured/i.test(body)) {
      throw new Error(
        "The app started without NEXT_PUBLIC_GROUPVAULT_CONTRACT; restart with the deployment env",
      )
    }
    const connected = await page
      .getByRole("button", { name: /\.testnet|\.near/i })
      .first()
      .isVisible()
      .catch(() => false)
    if (connected) {
      // Close the dialog if the wallet left it open.
      await page.keyboard.press("Escape").catch(() => {})
      return
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(
    "Timed out waiting for a real wallet session. Operator approval is required.",
  )
}
