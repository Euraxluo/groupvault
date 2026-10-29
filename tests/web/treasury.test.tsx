import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fundDao: vi.fn(), accountBalance: vi.fn() }))
const fundDao = mocks.fundDao
let daoState: Record<string, unknown>
let votesState: Record<string, unknown>
let searchParams = new URLSearchParams()

vi.mock("@/hooks/use-dao", () => ({
  useDao: () => daoState,
}))

vi.mock("@/hooks/use-votes", () => ({
  useVotes: () => votesState,
}))

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => ({ selector: {}, modal: {} }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dao/dao.testnet/treasury",
}))

vi.mock("@/components/mobile-navbar", () => ({
  MobileNavbar: () => null,
}))

vi.mock("@/lib/near/treasury", () => ({
  fundDao: mocks.fundDao,
}))

vi.mock("@/lib/near/rpc", () => ({
  NearRpc: class {
    accountBalance = mocks.accountBalance
  },
}))

import TreasuryPage from "@/app/dao/[daoId]/treasury/page"
import { GroupTreasury } from "@/components/group-treasury"

beforeEach(() => {
  vi.clearAllMocks()
  searchParams = new URLSearchParams()
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
    lastAddedId: null,
    addTransfer: vi.fn(),
    approve: vi.fn(),
    refresh: vi.fn(),
  }
})

describe("treasury", () => {
  it("funds the DAO with parsed yocto from human NEAR", async () => {
    fundDao.mockResolvedValue({ transactionHash: "tx", receiptIds: [] })
    render(<GroupTreasury daoId="dao.testnet" />)

    fireEvent.change(screen.getByLabelText("转入金额（NEAR）"), {
      target: { value: "0.5" },
    })
    fireEvent.click(screen.getByRole("button", { name: /从钱包转入金库/ }))

    await waitFor(() =>
      expect(fundDao).toHaveBeenCalledWith(
        expect.anything(),
        "alice.testnet",
        "dao.testnet",
        "500000000000000000000000",
      ),
    )
  })

  it("keeps separate human inputs for fund and proposal", async () => {
    const addTransfer = vi.fn().mockResolvedValue(4)
    votesState = { ...votesState, addTransfer }
    render(<GroupTreasury daoId="dao.testnet" />)

    fireEvent.change(screen.getByLabelText("转入金额（NEAR）"), {
      target: { value: "0.5" },
    })
    fireEvent.change(screen.getByPlaceholderText("接收账户，例如 alice.testnet"), {
      target: { value: "bob.testnet" },
    })
    fireEvent.change(screen.getByPlaceholderText("金额（NEAR）"), {
      target: { value: "0.1" },
    })
    fireEvent.change(screen.getByPlaceholderText("提案说明"), {
      target: { value: "支付设计费" },
    })
    fireEvent.click(screen.getByRole("button", { name: /发起转账提案/ }))

    await waitFor(() =>
      expect(addTransfer).toHaveBeenCalledWith({
        receiverId: "bob.testnet",
        amount: "100000000000000000000000",
        description: "支付设计费",
      }),
    )
  })

  it("states native Transfer shape and no extra execution", () => {
    render(<GroupTreasury daoId="dao.testnet" />)
    expect(screen.getByText(/token_id 为空、msg 为 null/)).toBeInTheDocument()
    expect(screen.getByText(/无需额外执行签名/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/yoctoNEAR/i)).not.toBeInTheDocument()
  })

  it("renders a confirmed zero balance honestly", async () => {
    searchParams = new URLSearchParams("from=convert&groupId=16")
    mocks.accountBalance.mockResolvedValue(0n)
    await act(async () => {
      render(<TreasuryPage params={Promise.resolve({ daoId: "dao.testnet" })} />)
    })

    expect(await screen.findByText("升级成功")).toBeInTheDocument()
    expect(await screen.findByText("0 NEAR")).toBeInTheDocument()
    expect(screen.getByText(/金库当前为空/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /回到聊天/ })[0]).toHaveAttribute(
      "href",
      "/groups/16/chat",
    )
  })

  it("renders an RPC error instead of a fabricated zero", async () => {
    searchParams = new URLSearchParams("from=convert&groupId=16")
    mocks.accountBalance.mockRejectedValue(
      new Error("NEAR RPC query failed: HTTP 429"),
    )
    await act(async () => {
      render(<TreasuryPage params={Promise.resolve({ daoId: "dao.testnet" })} />)
    })

    expect(await screen.findByText("余额暂不可用")).toBeInTheDocument()
    expect(screen.getByText(/HTTP 429/)).toBeInTheDocument()
    expect(screen.queryByText("0 NEAR")).not.toBeInTheDocument()
  })
})
