import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fundDao: vi.fn() }))
const fundDao = mocks.fundDao
let daoState: Record<string, unknown>
let votesState: Record<string, unknown>

vi.mock("@/hooks/use-dao", () => ({
  useDao: () => daoState,
}))

vi.mock("@/hooks/use-votes", () => ({
  useVotes: () => votesState,
}))

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => ({ selector: {}, modal: {} }),
}))

vi.mock("@/lib/near/treasury", () => ({
  fundDao: mocks.fundDao,
}))

vi.mock("@/lib/near/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/near/config")>()
  return actual
})

import { GroupTreasury } from "@/components/group-treasury"

beforeEach(() => {
  vi.clearAllMocks()
  daoState = {
    accountId: "alice.testnet",
    policy: { proposal_bond: "1000000000000000000000000" },
    stakingContract: "staking.testnet",
    delegation: "1",
    sputnik: {},
    staking: {},
    loading: false,
    error: null,
    refresh: vi.fn(),
  }
  votesState = {
    proposals: [],
    loading: false,
    error: null,
    addTransfer: vi.fn(),
    approve: vi.fn(),
    refresh: vi.fn(),
  }
})

describe("treasury", () => {
  it("funds the DAO with a wallet transfer", async () => {
    fundDao.mockResolvedValue({ transactionHash: "tx", receiptIds: [] })
    render(<GroupTreasury daoId="dao.testnet" />)

    const input = screen.getAllByPlaceholderText(/yoctoNEAR/i)[0]!
    fireEvent.change(input, { target: { value: "1000" } })
    fireEvent.click(screen.getByRole("button", { name: /Fund DAO/i }))

    await waitFor(() =>
      expect(fundDao).toHaveBeenCalledWith(
        expect.anything(),
        "alice.testnet",
        "dao.testnet",
        "1000",
      ),
    )
  })

  it("states native Transfer shape and no extra execution", () => {
    render(<GroupTreasury daoId="dao.testnet" />)
    expect(
      screen.getByText(/token_id=&quot;&quot; and msg=null|token_id="" and msg=null/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/no extra execute signature/i)).toBeInTheDocument()
  })
})
