"use client"

import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui"
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet"

import { getNearConfig, requireGroupVault } from "./config"

export interface NearSession {
  selector: WalletSelector
  modal: WalletSelectorModal
  accountId: string | null
}

let sessionPromise: Promise<NearSession> | null = null

/**
 * The wallet selector is the only product signer. This module never creates a
 * keypair, never stores a seed, and never delegates signing to a backend.
 */
export async function createNearWalletSelector(): Promise<NearSession> {
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
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
  const state = selector.store.getState()
  return state.accounts.find((account) => account.active)?.accountId ?? null
}

export async function getConnectedAccount(): Promise<string | null> {
  const session = await createNearWalletSelector()
  return getConnectedAccountId(session.selector)
}

export async function connectWallet(): Promise<string> {
  const session = await createNearWalletSelector()
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

export async function disconnectWallet(): Promise<void> {
  const session = await createNearWalletSelector()
  const walletId = session.selector.store.getState().selectedWalletId
  if (walletId) {
    const wallet = await session.selector.wallet(walletId)
    await wallet.signOut()
  }
}

export function resetNearSessionForTests(): void {
  sessionPromise = null
}
