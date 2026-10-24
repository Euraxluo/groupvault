/**
 * Ordered product steps for the real A/B demo. The UI uses this to keep the
 * setup sequence explicit instead of hiding proposals behind one "governance"
 * button.
 */
export const GOVERNANCE_SEQUENCE = [
  "Convert",
  "Deploy and initialize staking",
  "DAO proposal: SetStakingContract",
  "DAO proposal: ChangePolicyUpdateDefaultVotePolicy(TokenWeight)",
  "Staking storage deposit",
  "FT ft_transfer_call with an empty msg",
  "Delegate stake",
  "Fund the DAO",
  "DAO proposal: Transfer",
  "Approve the exact Transfer proposal",
] as const

export const TOKENWEIGHT_PROPOSAL_LABEL =
  "ChangePolicyUpdateDefaultVotePolicy(TokenWeight)"
