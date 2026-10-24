import type { WalletSelector } from "@near-wallet-selector/core"

import { GAS } from "./config"
import { signAndSendTransaction, type SignedReceipt } from "./actions"
import type { NearRpc } from "./rpc"

export interface Policy {
  roles: {
    role: string
    kind: "Everyone" | { Group: string[] }
    permissions: string[]
  }[]
  default_vote_policy: {
    weight_kind: "RoleWeight" | "TokenWeight"
    quorum: string
    threshold: string | [number, number]
  }
  proposal_bond: string
  proposal_period: string
  bounty_bond: string
  bounty_period: string
}

export interface Proposal {
  id: number
  proposer: string
  description: string
  kind: Record<string, unknown>
  status: string
}

export const SPUTNIK_GAS = GAS

export function addProposalAction(proposal: {
  description: string
  kind: Record<string, unknown>
}) {
  return {
    methodName: "add_proposal",
    args: { proposal },
  }
}

export function actProposalAction(id: number, action: string, kind: Record<string, unknown>) {
  return {
    methodName: "act_proposal",
    args: { id, action, proposal: kind, memo: null },
  }
}

export function tokenWeightPolicyUpdate() {
  return {
    ChangePolicyUpdateDefaultVotePolicy: {
      vote_policy: {
        weight_kind: "TokenWeight",
        quorum: "0",
        threshold: [1, 2],
      },
    },
  }
}

export function roleWeightPolicyUpdate() {
  return {
    ChangePolicyUpdateDefaultVotePolicy: {
      vote_policy: {
        weight_kind: "RoleWeight",
        quorum: "0",
        threshold: [1, 2],
      },
    },
  }
}

export function setStakingContractKind(stakingId: string) {
  return { SetStakingContract: { staking_id: stakingId } }
}

export function transferKind(input: {
  receiverId: string
  amount: string
  tokenId?: string
  msg?: string | null
}) {
  return {
    Transfer: {
      receiver_id: input.receiverId,
      amount: input.amount,
      token_id: input.tokenId ?? "",
      msg: input.msg ?? null,
    },
  }
}

export interface SputnikClient {
  getPolicy(daoId: string): Promise<Policy>
  getProposal(daoId: string, id: number): Promise<Proposal>
  /**
   * Sputnik ids start at 0 and `get_last_proposal_id` returns the *next*
   * counter, so the newest existing proposal is this value minus one.
   * Returns -1 when the DAO has no proposals yet.
   */
  getNewestProposalId(daoId: string): Promise<number>
  getStakingContract(daoId: string): Promise<string | null>
  addProposal(
    signerId: string,
    daoId: string,
    proposal: { description: string; kind: Record<string, unknown> },
    bond: string,
  ): Promise<SignedReceipt>
  actProposal(
    signerId: string,
    daoId: string,
    id: number,
    action: "VoteApprove" | "VoteReject" | "VoteRemove",
    kind: Record<string, unknown>,
  ): Promise<SignedReceipt>
}

export function createSputnikClient(selector: WalletSelector, rpc: NearRpc): SputnikClient {
  return {
    getPolicy: (daoId) =>
      rpc.view<Policy>({ contractId: daoId, methodName: "get_policy" }),
    getProposal: (daoId, id) =>
      rpc.view<Proposal>({
        contractId: daoId,
        methodName: "get_proposal",
        args: { id },
      }),
    getNewestProposalId: (daoId) =>
      rpc.view<number>({
        contractId: daoId,
        methodName: "get_last_proposal_id",
      }).then((next) => Number(next) - 1),
    getStakingContract: (daoId) =>
      rpc.view<string | null>({
        contractId: daoId,
        methodName: "get_staking_contract",
      }),
    addProposal: (signerId, daoId, proposal, bond) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: daoId,
        methodName: "add_proposal",
        args: { proposal },
        gas: GAS.addProposal,
        deposit: bond,
      }),
    actProposal: (signerId, daoId, id, action, kind) =>
      signAndSendTransaction(selector, signerId, {
        receiverId: daoId,
        methodName: "act_proposal",
        args: { id, action, proposal: kind, memo: null },
        gas: GAS.actProposal,
      }),
  }
}
