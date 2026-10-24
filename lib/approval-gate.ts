import type { Policy, Proposal, SputnikClient } from "@/lib/near/sputnik"
import type { StakingClient } from "@/lib/near/staking"

/**
 * TokenWeight vote gate. A zero delegation must be rejected before the wallet
 * is asked to approve, so a paid member with no stake cannot change proposal
 * state.
 */
export async function applyApprovalWithWeightGate(input: {
  daoId: string
  proposal: Proposal
  accountId: string
  client: SputnikClient
  staking: Pick<StakingClient, "getDelegation">
}): Promise<void> {
  const { daoId, proposal, accountId, client, staking } = input
  const [policy, stakingId]: [Policy, string | null] = await Promise.all([
    client.getPolicy(daoId),
    client.getStakingContract(daoId),
  ])

  if (policy.default_vote_policy.weight_kind === "TokenWeight") {
    if (!stakingId) {
      throw new Error("TokenWeight is enabled but staking is not set")
    }
    // `delegation_balance_of` is a DAO view that reads its staking contract.
    const delegation = await staking.getDelegation(daoId, accountId)
    if (BigInt(delegation) <= 0n) {
      throw new Error("Zero voting weight: stake the join FT before voting")
    }
  }

  await client.actProposal(accountId, daoId, proposal.id, "VoteApprove", proposal.kind)
}
