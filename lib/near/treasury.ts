import { actionCreators, type WalletSelector } from "@near-wallet-selector/core"

import { signAndSendTransaction, type SignedReceipt } from "./actions"

export async function fundDao(
  selector: WalletSelector,
  signerId: string,
  daoId: string,
  amount: string,
): Promise<SignedReceipt> {
  const walletId = selector.store.getState().selectedWalletId
  if (!walletId) throw new Error("Wallet is not connected")
  const wallet = await selector.wallet(walletId)
  const outcome = await wallet.signAndSendTransaction({
    signerId,
    receiverId: daoId,
    actions: [actionCreators.transfer(BigInt(amount))],
  })
  return {
    transactionHash: outcome?.transaction_outcome?.id ?? outcome?.transaction?.hash ?? "",
    receiptIds: (outcome?.receipts_outcome ?? []).map(
      (receipt: { id: string }) => receipt.id,
    ),
  }
}

export { signAndSendTransaction }
