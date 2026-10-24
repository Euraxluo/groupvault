import type { WalletSelector } from "@near-wallet-selector/core"

import { GAS, ONE_YOCTO } from "./config"
import { signAndSendTransaction, type SignedReceipt } from "./actions"

export interface JoinTransferInput {
  signerId: string
  groupId: number
  joinFt: string
  amount: string
  contractId?: string
}

export function buildJoinMessage(groupId: number): string {
  return JSON.stringify({ action: "join", group_id: groupId })
}

export async function joinGroup(
  selector: WalletSelector,
  input: JoinTransferInput,
): Promise<SignedReceipt> {
  const contractId = input.contractId
  if (!contractId) {
    throw new Error(
      "NEXT_PUBLIC_GROUPVAULT_CONTRACT is not configured; deploy the contract first (T010)",
    )
  }
  return signAndSendTransaction(selector, input.signerId, {
    receiverId: input.joinFt,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: contractId,
      amount: input.amount,
      memo: null,
      msg: buildJoinMessage(input.groupId),
    },
    gas: GAS.join,
    deposit: ONE_YOCTO,
  })
}

export async function ftBalance(
  rpc: { view: <T>(options: { contractId: string; methodName: string; args?: Record<string, unknown> }) => Promise<T> },
  tokenId: string,
  accountId: string,
): Promise<string> {
  const value = await rpc.view<string>({
    contractId: tokenId,
    methodName: "ft_balance_of",
    args: { account_id: accountId },
  })
  return typeof value === "string" ? value : String(value)
}
