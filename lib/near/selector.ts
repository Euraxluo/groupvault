"use client"

import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui"
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet"

import { getNearConfig, requireGroupVault } from "./config"
import {
  clearDemoKeypairSession,
  getDemoKeypairSession,
  hydrateDemoKeypairFromRuntime,
  setDemoKeypairSession,
  type DemoKeypairCredentials,
} from "./keypair-session"
import { clearDemoAccountCache } from "./keypair-signer"

export interface NearSession {
  selector: WalletSelector
  modal: WalletSelectorModal
  accountId: string | null
}

let sessionPromise: Promise<NearSession> | null = null

/**
 * Wallet selector remains the default product signer. Demo keypair mode is an
 * alternate testnet path for hackathon/e2e — keys never leave the tab session.
 */
export async function createNearWalletSelector(): Promise<NearSession> {
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    hydrateDemoKeypairFromRuntime()
    const config = getNearConfig()
    const contractId = requireGroupVault(config)
    const selector = await setupWalletSelector({
      network: config.network,
      modules: [setupMyNearWallet()],
    })
    const modal = setupModal(selector, {
      contractId,
      description: "Sign in to create, join, and convert a GroupVault group.",
    })
    return {
      selector,
      modal,
      accountId: getConnectedAccountId(selector),
    }
  })()

  return sessionPromise
}

export function getConnectedAccountId(selector: WalletSelector): string | null {
  const demo = getDemoKeypairSession()
  if (demo) return demo.accountId
  const state = selector.store.getState()
  return state.accounts.find((account) => account.active)?.accountId ?? null
}

export async function getConnectedAccount(): Promise<string | null> {
  const session = await createNearWalletSelector()
  return getConnectedAccountId(session.selector)
}

export async function connectWallet(): Promise<string> {
  const session = await createNearWalletSelector()
  // Prefer an already-hydrated demo keypair (Playwright injection / prior paste).
  const demo = getDemoKeypairSession()
  if (demo) return demo.accountId

  await session.modal.show()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      subscription.unsubscribe()
      reject(new Error("Wallet connection timed out"))
    }, 180_000)
    const subscription = session.selector.store.observable.subscribe(() => {
      const accountId = getConnectedAccountId(session.selector)
      if (accountId) {
        window.clearTimeout(timeout)
        subscription.unsubscribe()
        resolve(accountId)
      }
    })
  })
}

/**
 * Connect with a testnet ed25519 keypair for demo/e2e. Refuses on mainnet.
 */
export async function connectWithKeypair(
  credentials: DemoKeypairCredentials,
): Promise<string> {
  const config = getNearConfig()
  if (config.network !== "testnet") {
    throw new Error("Keypair (demo) connect is testnet-only")
  }
  // Ensure selector is initialized so the rest of the app has a NearSession.
  await createNearWalletSelector()
  setDemoKeypairSession(credentials)
  clearDemoAccountCache()
  return credentials.accountId.trim()
}

export async function disconnectWallet(): Promise<void> {
  clearDemoKeypairSession()
  clearDemoAccountCache()
  const session = await createNearWalletSelector()
  const walletId = session.selector.store.getState().selectedWalletId
  if (walletId) {
    const wallet = await session.selector.wallet(walletId)
    await wallet.signOut()
  }
}

export function resetNearSessionForTests(): void {
  sessionPromise = null
  clearDemoKeypairSession()
  clearDemoAccountCache()
}
