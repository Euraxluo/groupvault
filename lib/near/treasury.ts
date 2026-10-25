import { actionCreators, type WalletSelector } from "@near-wallet-selector/core"

import { signAndSendTransaction, type SignedReceipt } from "./actions"
import { isDemoKeypairActive } from "./keypair-session"
import { transferWithKeypair } from "./keypair-signer"

async function nativeTransfer(
  selector: WalletSelector,
  signerId: string,
  receiverId: string,
  amount: string,
): Promise<SignedReceipt> {
  if (isDemoKeypairActive()) {
    return transferWithKeypair(signerId, receiverId, amount)
  }

  const walletId = selector.store.getState().selectedWalletId
  if (!walletId) throw new Error("Wallet is not connected")
  const wallet = await selector.wallet(walletId)
  const outcome = await wallet.signAndSendTransaction({
    signerId,
    receiverId,
    actions: [actionCreators.transfer(BigInt(amount))],
  })
  return {
    transactionHash:
      outcome?.transaction_outcome?.id ?? outcome?.transaction?.hash ?? "",
    receiptIds: (outcome?.receipts_outcome ?? []).map(
      (receipt: { id: string }) => receipt.id,
    ),
  }
}

/** Fund a DAO treasury with native NEAR from the connected wallet. */
export async function fundDao(
  selector: WalletSelector,
  signerId: string,
  daoId: string,
  amount: string,
): Promise<SignedReceipt> {
  return nativeTransfer(selector, signerId, daoId, amount)
}

/**
 * Tip a group member with a direct wallet NEAR transfer.
 * This is not a treasury proposal — just peer-to-peer.
 */
export async function tipMember(
  selector: WalletSelector,
  signerId: string,
  receiverId: string,
  amount: string,
): Promise<SignedReceipt> {
  if (!receiverId || receiverId === signerId) {
    throw new Error("Pick a different member to tip")
  }
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error("Tip amount must be a positive yoctoNEAR integer")
  }
  return nativeTransfer(selector, signerId, receiverId, amount)
}

export { signAndSendTransaction }
