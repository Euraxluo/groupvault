import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const addProposal = vi.fn()
const storageDeposit = vi.fn()
const depositStake = vi.fn()
const delegate = vi.fn()
const refresh = vi.fn()

let daoState: Record<string, unknown>

vi.mock("@/hooks/use-dao", () => ({
  useDao: () => daoState,
}))

vi.mock("@/lib/near/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/near/config")>()
  return {
    ...actual,
    getNearConfig: () => ({
      ...actual.getNearConfig(),
      joinFtContractId: "ft.testnet",
    }),
  }
})

import { StakingSetup } from "@/components/staking-setup"

beforeEach(() => {
  vi.clearAllMocks()
  daoState = {
    accountId: "alice.testnet",
    policy: {
      default_vote_policy: {
        weight_kind: "RoleWeight",
        quorum: "0",
        threshold: [1, 2],
      },
      proposal_bond: "1000000000000000000000000",
    },
    stakingContract: null,
    delegation: "0",
    sputnik: { addProposal },
    staking: { storageDeposit, depositStake, delegate },
    loading: false,
    error: null,
    refresh,
  }
})

describe("staking setup", () => {
  it("adds SetStakingContract with the policy bond", async () => {
    addProposal.mockResolvedValue({})
    render(<StakingSetup daoId="dao.testnet" />)

    fireEvent.change(screen.getByPlaceholderText(/staking account ID/i), {
      target: { value: "staking.testnet" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: /Add SetStakingContract proposal/i }),
    )

    await waitFor(() =>
      expect(addProposal).toHaveBeenCalledWith(
        "alice.testnet",
        "dao.testnet",
        {
          description: "Set GroupVault staking contract",
          kind: { SetStakingContract: { staking_id: "staking.testnet" } },
        },
        "1000000000000000000000000",
      ),
    )
  })

  it("requires staking before the TokenWeight proposal", () => {
    render(<StakingSetup daoId="dao.testnet" />)
    expect(
      screen.getByRole("button", { name: /Add TokenWeight policy proposal/i }),
    ).toBeDisabled()
  })

  it("ChangePolicyUpdateDefaultVotePolicy uses the exact TokenWeight payload", async () => {
    addProposal.mockResolvedValue({})
    daoState = {
      ...daoState,
      stakingContract: "staking.testnet",
      policy: {
        ...(daoState.policy as object),
        default_vote_policy: {
          weight_kind: "RoleWeight",
          quorum: "0",
          threshold: [1, 2],
        },
      },
    }
    render(<StakingSetup daoId="dao.testnet" />)

    fireEvent.click(
      screen.getByRole("button", { name: /Add TokenWeight policy proposal/i }),
    )
    await waitFor(() =>
      expect(addProposal).toHaveBeenCalledWith(
        "alice.testnet",
        "dao.testnet",
        {
          description: "ChangePolicyUpdateDefaultVotePolicy(TokenWeight)",
          kind: {
            ChangePolicyUpdateDefaultVotePolicy: {
              vote_policy: {
                weight_kind: "TokenWeight",
                quorum: "0",
                threshold: [1, 2],
              },
            },
          },
        },
        "1000000000000000000000000",
      ),
    )
  })

  it("runs storage_deposit, ft_transfer_call, and delegate in order", async () => {
    daoState = { ...daoState, stakingContract: "staking.testnet" }
    storageDeposit.mockResolvedValue({})
    depositStake.mockResolvedValue({})
    delegate.mockResolvedValue({})
    render(<StakingSetup daoId="dao.testnet" />)

    fireEvent.change(screen.getByLabelText(/Stake amount/i), {
      target: { value: "5000000" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Storage deposit/i }))
    await waitFor(() =>
      expect(storageDeposit).toHaveBeenCalledWith(
        "alice.testnet",
        "staking.testnet",
        "alice.testnet",
      ),
    )

    fireEvent.click(screen.getByRole("button", { name: /FT transfer/i }))
    await waitFor(() =>
      expect(depositStake).toHaveBeenCalledWith(
        "alice.testnet",
        "ft.testnet",
        "staking.testnet",
        "5000000",
      ),
    )

    fireEvent.click(screen.getByRole("button", { name: /^Delegate$/i }))
    await waitFor(() =>
      expect(delegate).toHaveBeenCalledWith(
        "alice.testnet",
        "staking.testnet",
        "alice.testnet",
        "5000000",
      ),
    )
  })
})
