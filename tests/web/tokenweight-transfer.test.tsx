import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const actProposal = vi.fn()
const getPolicy = vi.fn()
const getStakingContract = vi.fn()
const getDelegation = vi.fn()

let sessionState: Record<string, unknown> | null

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => sessionState,
}))

vi.mock("@/lib/near/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/near/config")>()
  return actual
})

vi.mock("@/lib/near/rpc", () => ({
  NearRpc: class {},
}))

vi.mock("@/lib/near/sputnik", async () => {
  const actual = await vi.importActual<typeof import("@/lib/near/sputnik")>(
    "@/lib/near/sputnik",
  )
  return {
    ...actual,
    createSputnikClient: () => ({
      getPolicy,
      getStakingContract,
      actProposal,
      addProposal: vi.fn(),
      getProposal: vi.fn(),
    }),
  }
})

vi.mock("@/lib/near/staking", async () => {
  const actual = await vi.importActual<typeof import("@/lib/near/staking")>(
    "@/lib/near/staking",
  )
  return {
    ...actual,
    createStakingClient: () => ({ getDelegation }),
  }
})

import { applyApprovalWithWeightGate } from "@/lib/approval-gate"

beforeEach(() => {
  vi.clearAllMocks()
  sessionState = {
    selector: {
      store: {
        getState: () => ({
          selectedWalletId: "my-near-wallet",
          accounts: [{ accountId: "alice.testnet", active: true }],
        }),
      },
    },
    modal: {},
  }
})

const proposal = {
  id: 4,
  proposer: "alice.testnet",
  description: "Pay Bob",
  kind: {
    Transfer: {
      receiver_id: "bob.testnet",
      amount: "1000",
      token_id: "",
      msg: null,
    },
  },
  status: "InProgress",
}

describe("TokenWeight approval gate", () => {
  it("rejects a zero-weight approval without calling act_proposal", async () => {
    getPolicy.mockResolvedValue({
      default_vote_policy: { weight_kind: "TokenWeight", quorum: "0", threshold: [1, 2] },
      proposal_bond: "1",
    })
    getStakingContract.mockResolvedValue("staking.testnet")
    getDelegation.mockResolvedValue("0")

    await expect(
      applyApprovalWithWeightGate({
        daoId: "dao.testnet",
        proposal,
        accountId: "alice.testnet",
        client: {
          getPolicy,
          getStakingContract,
          actProposal,
          addProposal: vi.fn(),
          getProposal: vi.fn(),
        },
        staking: { getDelegation },
      }),
    ).rejects.toThrow(/Zero voting weight/i)
    expect(actProposal).not.toHaveBeenCalled()
  })

  it("sends VoteApprove with the exact Transfer kind when weight is positive", async () => {
    getPolicy.mockResolvedValue({
      default_vote_policy: { weight_kind: "TokenWeight", quorum: "0", threshold: [1, 2] },
      proposal_bond: "1",
    })
    getStakingContract.mockResolvedValue("staking.testnet")
    getDelegation.mockResolvedValue("9")
    actProposal.mockResolvedValue({})

    await applyApprovalWithWeightGate({
      daoId: "dao.testnet",
      proposal,
      accountId: "alice.testnet",
      client: {
        getPolicy,
        getStakingContract,
        actProposal,
        addProposal: vi.fn(),
        getProposal: vi.fn(),
      },
      staking: { getDelegation },
    })

    await waitFor(() =>
      expect(actProposal).toHaveBeenCalledWith(
        "alice.testnet",
        "dao.testnet",
        4,
        "VoteApprove",
        proposal.kind,
      ),
    )
  })

  it("renders the exact proposal kind in the approval UI", async () => {
    const { ProposalList } = await import("@/components/group-treasury")
    render(
      <ProposalList proposals={[proposal]} onApprove={vi.fn()} />,
    )
    expect(screen.getByText(/Pay Bob/)).toBeInTheDocument()
    expect(screen.getByText(/"token_id": ""/)).toBeInTheDocument()
    expect(screen.getByText(/"msg": null/)).toBeInTheDocument()
  })
})
