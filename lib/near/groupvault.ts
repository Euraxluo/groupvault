import type { WalletSelector } from "@near-wallet-selector/core"

import { GAS } from "./config"
import { signAndSendTransaction, type SignedReceipt } from "./actions"
import type { NearRpc } from "./rpc"

export interface GroupView {
  id: number
  owner: string
  name: string
  description: string
  join_fee: string
  join_ft: string
  member_count: number
  dao_id: string | null
  convert_pending: boolean
  created_at: number
}

export interface CreateGroupInput {
  name: string
  description: string
  joinFee: string
  joinFt: string
  initialMembers: string[]
}

export interface GroupVaultClient {
  createGroup(signerId: string, input: CreateGroupInput, deposit: string): Promise<SignedReceipt>
  getGroup(groupId: number): Promise<GroupView>
  getGroups(fromIndex: number, limit: number): Promise<GroupView[]>
  getMembers(groupId: number): Promise<string[]>
  getDaoId(groupId: number): Promise<string | null>
  isMember(groupId: number, accountId: string): Promise<boolean>
  sendMessage(signerId: string, groupId: number, text: string): Promise<SignedReceipt>
  convertToDao(
    signerId: string,
    groupId: number,
    daoName: string,
    purpose: string,
    deposit: string,
  ): Promise<SignedReceipt>
  getJoinFeeBalance(groupId: number): Promise<string>
}

export function createGroupVaultClient(
  selector: WalletSelector,
  rpc: NearRpc,
  contractId: string,
): GroupVaultClient {
  if (!contractId) {
    throw new Error(
      "NEXT_PUBLIC_GROUPVAULT_CONTRACT is not configured; deploy the contract first (T010)",
    )
  }
  return {
    createGroup: (signerId, input, deposit) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: contractId,
        methodName: "create_group",
        args: {
          name: input.name,
          description: input.description,
          join_fee: input.joinFee,
          join_ft: input.joinFt,
          initial_members: input.initialMembers,
        },
        gas: GAS.createGroup,
        deposit,
      }),
    getGroup: (groupId) =>
      rpc.view<GroupView>({
        contractId,
        methodName: "get_group",
        args: { group_id: groupId },
      }),
    getGroups: (fromIndex, limit) =>
      rpc.view<GroupView[]>({
        contractId,
        methodName: "get_groups",
        args: { from_index: fromIndex, limit },
      }),
    getMembers: (groupId) =>
      rpc.view<string[]>({
        contractId,
        methodName: "get_members",
        args: { group_id: groupId },
      }),
    getDaoId: (groupId) =>
      rpc.view<string | null>({
        contractId,
        methodName: "get_dao_id",
        args: { group_id: groupId },
      }),
    isMember: (groupId, accountId) =>
      rpc.view<boolean>({
        contractId,
        methodName: "is_member",
        args: { group_id: groupId, account_id: accountId },
      }),
    sendMessage: (signerId, groupId, text) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: contractId,
        methodName: "send_message",
        args: { group_id: groupId, text },
        gas: GAS.chat,
      }),
    convertToDao: (signerId, groupId, daoName, purpose, deposit) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: contractId,
        methodName: "convert_to_dao",
        args: { group_id: groupId, dao_name: daoName, purpose },
        gas: GAS.convert,
        deposit,
      }),
    getJoinFeeBalance: (groupId) =>
      rpc.view<{ "0"?: string } & string>({
        contractId,
        methodName: "get_join_fee_balance",
        args: { group_id: groupId },
      }).then((value) => (typeof value === "string" ? value : String(value?.["0"] ?? value))),
  }
}
