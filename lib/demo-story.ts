/**
 * Demo story anchors. Values match artifacts/demo-input.json when present.
 * Kept as compile-time constants so the browser never reads the repo file.
 */
export const DEMO_STORY = {
  network: "testnet",
  groupId: 13,
  daoId: "groupvault-13.sputnikv2.testnet",
  stakingContractId: "sputnikstaking.gv-deployer-1024-204559.testnet",
  joinFt: "gv-deployer-1024-204559-ft.testnet",
  ownerAccountId: "gv-a-1024-210252.testnet",
  memberAccountId: "gv-b-1024-210252.testnet",
  /** Known proposal ids from the verified governance run. */
  proposalIds: [1, 2, 3, 4] as const,
  transferProposalId: 4,
} as const

export type StoryStepId =
  | "connect"
  | "create"
  | "groups"
  | "discover"
  | "join"
  | "overview"
  | "chat"
  | "convert"
  | "dao"
  | "staking-setup"
  | "stake"
  | "treasury"
  | "proposals"
  | "proposal-detail"
  | "qr"
  | "inbox"

export interface StoryStep {
  id: StoryStepId
  number: string
  title: string
  copy: string
  href: string
  cta: string
}

export function buildStorySteps(anchors: {
  groupId: number
  daoId: string
  proposalId: number
}): StoryStep[] {
  const { groupId, daoId, proposalId } = anchors
  return [
    {
      id: "connect",
      number: "01",
      title: "Connect wallet",
      copy: "MyNearWallet or Keypair (demo). No backend signing.",
      href: "/",
      cta: "Home / Connect",
    },
    {
      id: "create",
      number: "02",
      title: "Create paid group",
      copy: "Owner signs create_group once.",
      href: "/groups/new",
      cta: "New group",
    },
    {
      id: "groups",
      number: "03",
      title: "Groups list",
      copy: "Bounded on-chain discovery.",
      href: "/groups",
      cta: "Open groups",
    },
    {
      id: "discover",
      number: "04",
      title: "Discover",
      copy: "Public cards with Join CTA.",
      href: "/discover",
      cta: "Discover",
    },
    {
      id: "join",
      number: "05",
      title: "Paid join wall",
      copy: "ft_transfer_call. Paid join ≠ vote.",
      href: `/groups/${groupId}/join`,
      cta: `Join group ${groupId}`,
    },
    {
      id: "overview",
      number: "06",
      title: "Group overview",
      copy: "Members, fee, dao_id, Convert.",
      href: `/groups/${groupId}`,
      cta: "Group overview",
    },
    {
      id: "chat",
      number: "07",
      title: "Group chat",
      copy: "Public env::log_str messages.",
      href: `/groups/${groupId}/chat`,
      cta: "Open chat",
    },
    {
      id: "convert",
      number: "08",
      title: "Convert to DAO",
      copy: "Owner → factory.create. Not threshold crypto.",
      href: `/groups/${groupId}/convert`,
      cta: "Convert",
    },
    {
      id: "dao",
      number: "09",
      title: "DAO hub",
      copy: "Policy, staking, treasury entry.",
      href: `/dao/${daoId}`,
      cta: "DAO hub",
    },
    {
      id: "staking-setup",
      number: "10",
      title: "Staking setup",
      copy: "SetStakingContract + TokenWeight.",
      href: `/dao/${daoId}/staking/setup`,
      cta: "Staking setup",
    },
    {
      id: "stake",
      number: "11",
      title: "Stake UI",
      copy: "Storage deposit → FT transfer → delegate.",
      href: `/dao/${daoId}/stake`,
      cta: "Stake",
    },
    {
      id: "treasury",
      number: "12",
      title: "Treasury + Transfer",
      copy: "Fund DAO, add native Transfer proposal.",
      href: `/dao/${daoId}/treasury`,
      cta: "Treasury",
    },
    {
      id: "proposals",
      number: "13",
      title: "Proposals",
      copy: "Load and approve with exact kind.",
      href: `/dao/${daoId}/proposals?ids=${DEMO_STORY.proposalIds.join(",")}`,
      cta: "Proposals",
    },
    {
      id: "proposal-detail",
      number: "14",
      title: "Proposal detail",
      copy: "Approve / reject with weight gate.",
      href: `/dao/${daoId}/proposals/${proposalId}`,
      cta: `Proposal #${proposalId}`,
    },
    {
      id: "qr",
      number: "15",
      title: "QR card",
      copy: "Share accountId as a QR.",
      href: "/me/qr",
      cta: "My QR",
    },
    {
      id: "inbox",
      number: "16",
      title: "Inbox",
      copy: "Pending proposals for the demo DAO.",
      href: "/inbox",
      cta: "Inbox",
    },
  ]
}

export const DEFAULT_STORY_STEPS = buildStorySteps({
  groupId: DEMO_STORY.groupId,
  daoId: DEMO_STORY.daoId,
  proposalId: DEMO_STORY.transferProposalId,
})
