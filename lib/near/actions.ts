import {
  actionCreators,
  type Action,
  type Transaction,
  type WalletSelector,
} from "@near-wallet-selector/core"

export interface FunctionCallInput {
  receiverId: string
  methodName: string
  args?: Record<string, unknown>
  gas: string
  deposit?: string
}

export function buildFunctionCall({
  methodName,
  args = {},
  gas,
  deposit = "0",
}: FunctionCallInput): Action {
  return actionCreators.functionCall(
    methodName,
    args,
    BigInt(gas),
    BigInt(deposit),
  )
}

export function buildTransaction(
  signerId: string,
  input: FunctionCallInput,
): Transaction {
  return {
    signerId,
    receiverId: input.receiverId,
    actions: [buildFunctionCall(input)],
  }
}

export interface SignedReceipt {
  transactionHash: string
  receiptIds: string[]
}

/**
 * Wallet-delegated call. The user approves in the wallet; this function only
 * assembles the action and reports what the wallet returned.
 */
export async function signAndSendTransaction(
  selector: WalletSelector,
  signerId: string,
  input: FunctionCallInput,
): Promise<SignedReceipt> {
  const walletId = selector.store.getState().selectedWalletId
  if (!walletId) {
    throw new Error("Wallet is not connected")
  }
  const wallet = await selector.wallet(walletId)
  const outcome = await wallet.signAndSendTransaction({
    signerId,
    receiverId: input.receiverId,
    actions: [buildFunctionCall(input)],
  })

  return {
    transactionHash: outcome?.transaction_outcome?.id ?? outcome?.transaction?.hash ?? "",
    receiptIds: (outcome?.receipts_outcome ?? []).map(
      (receipt: { id: string }) => receipt.id,
    ),
  }
}
