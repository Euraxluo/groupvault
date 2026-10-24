import type { WalletSelector } from "@near-wallet-selector/core"

import { GAS, ONE_YOCTO } from "./config"
import { signAndSendTransaction, type SignedReceipt } from "./actions"
import type { NearRpc } from "./rpc"

export interface StakingClient {
  getDelegation(stakingId: string, accountId: string): Promise<string>
  storageDeposit(signerId: string, stakingId: string, accountId: string): Promise<SignedReceipt>
  depositStake(
    signerId: string,
    tokenId: string,
    stakingId: string,
    amount: string,
  ): Promise<SignedReceipt>
  delegate(
    signerId: string,
    stakingId: string,
    accountId: string,
    amount: string,
  ): Promise<SignedReceipt>
}

export function createStakingClient(selector: WalletSelector, rpc: NearRpc): StakingClient {
  return {
    getDelegation: (stakingId, accountId) =>
      rpc.view<{ delegation_balance?: string } | string>({
        contractId: stakingId,
        methodName: "delegation_balance_of",
        args: { account_id: accountId },
      }).then((value) =>
        typeof value === "string"
          ? value
          : String(value?.delegation_balance ?? "0"),
      ),
    storageDeposit: (signerId, stakingId, accountId) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: stakingId,
        methodName: "storage_deposit",
        args: { account_id: accountId, registration_only: false },
        gas: GAS.storageDeposit,
        deposit: "100000000000000000000000",
      }),
    depositStake: (signerId, tokenId, stakingId, amount) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: tokenId,
        methodName: "ft_transfer_call",
        args: { receiver_id: stakingId, amount, memo: null, msg: "" },
        gas: GAS.ftTransfer,
        deposit: ONE_YOCTO,
      }),
    delegate: (signerId, stakingId, accountId, amount) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: stakingId,
        methodName: "delegate",
        args: { account_id: accountId, amount },
        gas: GAS.delegate,
      }),
  }
}
