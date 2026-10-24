import { homedir } from "node:os"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import type { Page } from "@playwright/test"

export const WALLET_APPROVAL_TIMEOUT_MS = 180_000

export interface DemoCredential {
  accountId: string
  privateKey: string
}

export function isDemoKeypairEnvSet(who: "A" | "B" | "any" = "any"): boolean {
  if (who === "any") {
    return Boolean(
      process.env.DEMO_PRIVATE_KEY_A ||
        process.env.DEMO_PRIVATE_KEY_B ||
        process.env.DEMO_PRIVATE_KEY,
    )
  }
  if (who === "A") {
    return Boolean(process.env.DEMO_PRIVATE_KEY_A || process.env.DEMO_PRIVATE_KEY)
  }
  return Boolean(process.env.DEMO_PRIVATE_KEY_B)
}

function credentialPath(accountId: string): string {
  return join(homedir(), ".near-credentials", "testnet", `${accountId}.json`)
}

/**
 * Resolve A/B credentials from env, falling back to ~/.near-credentials.
 * Keys are read only in the Playwright process — never committed.
 */
export function loadDemoCredential(who: "A" | "B"): DemoCredential {
  const accountEnv = who === "A" ? "DEMO_ACCOUNT_A" : "DEMO_ACCOUNT_B"
  const keyEnv = who === "A" ? "DEMO_PRIVATE_KEY_A" : "DEMO_PRIVATE_KEY_B"
  const accountId =
    process.env[accountEnv] ??
    (who === "A" ? process.env.DEMO_ACCOUNT_ID : undefined)
  if (!accountId) {
    throw new Error(`${accountEnv} must be set for keypair e2e`)
  }

  const fromEnv =
    process.env[keyEnv] ??
    (who === "A" ? process.env.DEMO_PRIVATE_KEY : undefined)
  if (fromEnv) {
    return { accountId, privateKey: fromEnv.trim() }
  }

  const path = credentialPath(accountId)
  if (!existsSync(path)) {
    throw new Error(
      `No ${keyEnv} and missing credential file ${path}. Export the key or create the near-credentials JSON.`,
    )
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    account_id?: string
    private_key?: string
  }
  if (!parsed.private_key) {
    throw new Error(`Credential file ${path} has no private_key`)
  }
  return {
    accountId: parsed.account_id ?? accountId,
    privateKey: parsed.private_key,
  }
}

/**
 * Inject credentials before app JS runs. Call before page.goto or after a
 * full reload. Prefer connectDemoKeypair which also drives the UI.
 */
export async function injectDemoKeypair(
  page: Page,
  credentials: DemoCredential,
): Promise<void> {
  await page.addInitScript((creds) => {
    ;(
      window as Window & {
        __GV_KEYPAIR__?: { accountId: string; privateKey: string }
      }
    ).__GV_KEYPAIR__ = creds
  }, credentials)
}

/**
 * Wait for a human to approve the wallet prompt — skipped when demo keypair
 * env/credentials are available (local signing, no extension).
 */
function usingDemoKeypairSigning(): boolean {
  if (process.env.DEMO_KEYPAIR_MODE === "1" || isDemoKeypairEnvSet()) return true
  try {
    if (process.env.DEMO_ACCOUNT_A || process.env.DEMO_ACCOUNT_B) {
      // Presence of a resolvable credential file implies local signing.
      loadDemoCredential(process.env.DEMO_ACCOUNT_B && !process.env.DEMO_ACCOUNT_A ? "B" : "A")
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function waitForWalletApproval(page: Page, label: string): Promise<void> {
  if (usingDemoKeypairSigning()) {
    // Local keypair signing has no wallet modal; wait until the UI leaves the
    // in-flight signing/sending state.
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const body = (await page.textContent("body")) ?? ""
      if (/rejected|cancelled|denied/i.test(body)) {
        throw new Error(`Keypair/wallet rejected the "${label}" request`)
      }
      if (/waiting for wallet|sending…|sending\.\.\.|connecting…/i.test(body)) {
        await page.waitForTimeout(500)
        continue
      }
      // Give the async keypair broadcast a brief moment after the label clears.
      await page.waitForTimeout(300)
      return
    }
    // Still return — keypair txs can complete without changing that string.
    return
  }

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

/** Match navbar account chip: full id or shortAccount (8…6). */
async function isAccountChipVisible(page: Page, accountId?: string): Promise<boolean> {
  if (accountId) {
    const short =
      accountId.length <= 18
        ? accountId
        : `${accountId.slice(0, 8)}…${accountId.slice(-6)}`
    if (await page.getByRole("button", { name: short, exact: true }).first().isVisible().catch(() => false)) {
      return true
    }
    if (await page.getByRole("button", { name: accountId, exact: true }).first().isVisible().catch(() => false)) {
      return true
    }
  }
  // Fallback: full suffix still present, or truncated “…estnet” / “…e.near”
  return page
    .getByRole("button", { name: /\.testnet|\.near|…[a-z0-9_-]{3,}/i })
    .first()
    .isVisible()
    .catch(() => false)
}

export async function connectDemoKeypair(
  page: Page,
  who: "A" | "B" = "A",
): Promise<void> {
  const credentials = loadDemoCredential(who)
  await injectDemoKeypair(page, credentials)

  // Keep the sessionStorage copy current, then reuse an already-connected
  // account instead of requiring the Connect button to exist.
  await page.evaluate((creds) => {
    window.sessionStorage.setItem("gv.demo.keypair", JSON.stringify(creds))
  }, credentials)

  if (await isAccountChipVisible(page, credentials.accountId)) {
    return
  }

  await page.getByRole("button", { name: /connect/i }).first().click()
  // Prefer UI path so sessionStorage is also set for the tab.
  const keypairButton = page.getByRole("button", { name: /Keypair \(demo\)/i })
  if (await keypairButton.isVisible().catch(() => false)) {
    await keypairButton.click()
    await page.getByLabel("Account ID").fill(credentials.accountId)
    await page.getByLabel("Private key").fill(credentials.privateKey)
    await page.getByRole("button", { name: /Connect keypair/i }).click()
  } else {
    // Injection already hydrated; Connect wallet resolves immediately.
    await page.getByRole("button", { name: /Connect wallet/i }).click()
  }

  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await isAccountChipVisible(page, credentials.accountId)) {
      await page.keyboard.press("Escape").catch(() => {})
      return
    }
    const body = (await page.textContent("body")) ?? ""
    if (/is not configured/i.test(body)) {
      throw new Error(
        "The app started without NEXT_PUBLIC_GROUPVAULT_CONTRACT; restart with the deployment env",
      )
    }
    await page.waitForTimeout(400)
  }
  throw new Error(`Timed out connecting demo keypair for ${who}`)
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
    if (await isAccountChipVisible(page)) {
      await page.keyboard.press("Escape").catch(() => {})
      return
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(
    "Timed out waiting for a real wallet session. Operator approval is required.",
  )
}

/**
 * Connect via demo keypair when credentials are available; otherwise MyNearWallet.
 */
export async function connectWalletForDemo(
  page: Page,
  who: "A" | "B" = "A",
): Promise<void> {
  if (isDemoKeypairEnvSet(who) || process.env.DEMO_KEYPAIR_MODE === "1") {
    // DEMO_KEYPAIR_MODE=1 with only credential files still works via loadDemoCredential.
    await connectDemoKeypair(page, who)
    return
  }
  // Also try credential files when DEMO_ACCOUNT_* is set (no private key env).
  if (process.env.DEMO_ACCOUNT_A || process.env.DEMO_ACCOUNT_B) {
    try {
      loadDemoCredential(who)
      await connectDemoKeypair(page, who)
      return
    } catch {
      // fall through to human wallet
    }
  }
  await connectMyNearWallet(page)
}
