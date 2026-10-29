import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
const create = vi.fn()
const join = vi.fn()
const refresh = vi.fn()
let groupState: Record<string, unknown>
let walletState: Record<string, unknown>
let hookState: Record<string, unknown> = {}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("@/hooks/use-near-wallet", () => ({
  useNearWallet: () => walletState,
  shortAccount: (value: string) => value,
}))

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => ({ selector: {}, modal: {} }),
}))

vi.mock("@/hooks/use-group-vault", () => ({
  useGroupVault: () => groupState,
  useCreateGroup: () => ({ create, submitting: false, error: hookState.error ?? null }),
  useJoinGroup: () => ({ join, submitting: false, error: hookState.joinError ?? null }),
}))

const isMember = vi.fn()

vi.mock("@/lib/near/groupvault", () => ({
  createGroupVaultClient: () => ({ isMember }),
}))

vi.mock("@/lib/near/deposits", () => ({
  CREATE_GROUP_DEPOSIT: "500000000000000000000000",
}))

vi.mock("@/lib/near/config", () => ({
  getNearConfig: () => ({
    network: "testnet",
    rpcUrl: "https://rpc.testnet.near.org",
    groupVaultContractId: "gv.testnet",
    joinFtContractId: "ft.testnet",
    factoryId: "sputnikv2.testnet",
    indexerUrl: "http://127.0.0.1:8787",
  }),
}))

import { CreateGroupDialog } from "@/components/create-group-dialog"
import { GroupJoinCard } from "@/components/group-join-card"

beforeEach(() => {
  vi.clearAllMocks()
  hookState = {}
  walletState = {
    ready: true,
    accountId: "bob.testnet",
    error: null,
    connecting: false,
  }
  groupState = {
    ready: true,
    loading: false,
    error: null,
    group: {
      id: 3,
      owner: "alice.testnet",
      name: "Builders",
      description: "Paid",
      join_fee: "1000000",
      join_ft: "ft.testnet",
      member_count: 1,
      dao_id: null,
      convert_pending: false,
      created_at: 1,
    },
    members: ["alice.testnet"],
    refresh,
  }
})

describe("create group flow", () => {
  it("sends the wallet-signed create with the configured FT", async () => {
    create.mockResolvedValue({
      transactionHash: "tx-create",
      receiptIds: ["r"],
      groupId: 7,
    })
    render(<CreateGroupDialog open onOpenChange={() => {}} />)

    fireEvent.change(screen.getByLabelText("群名"), { target: { value: "Builders" } })
    fireEvent.change(screen.getByLabelText("入群费（入群币）"), {
      target: { value: "1" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^创建$/ }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(
      {
        name: "Builders",
        description: "",
        joinFee: "1000000",
        joinFt: "ft.testnet",
        initialMembers: [],
      },
      "500000000000000000000000",
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups/7/chat"))
  })

  it("submits fractional human input as exact base units", async () => {
    create.mockResolvedValue({
      transactionHash: "tx-create",
      receiptIds: ["r"],
      groupId: 7,
    })
    render(<CreateGroupDialog open onOpenChange={() => {}} />)

    fireEvent.change(screen.getByLabelText("群名"), { target: { value: "Builders" } })
    fireEvent.change(screen.getByLabelText("入群费（入群币）"), {
      target: { value: "1.25" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^创建$/ }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0][0]).toMatchObject({ joinFee: "1250000" })
  })

  it("defaults the human join fee to 1", () => {
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText("入群费（入群币）")).toHaveValue("1")
  })

  it("blocks an empty group name before opening the wallet", async () => {
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^创建$/ }))
    expect(await screen.findByText("请填写群名")).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it("does not navigate when the wallet rejects", async () => {
    create.mockRejectedValue(new Error("User rejected"))
    hookState = { error: "User rejected" }
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText("群名"), { target: { value: "Builders" } })
    fireEvent.click(screen.getByRole("button", { name: /^创建$/ }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it("never redirects when the chain read returns no group id", async () => {
    create.mockResolvedValue({
      transactionHash: "tx-create",
      receiptIds: ["r"],
      groupId: null,
    })
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText("群名"), { target: { value: "Builders" } })
    fireEvent.click(screen.getByRole("button", { name: /^创建$/ }))

    expect(
      await screen.findByText(/群已创建，但链上暂时读不到群号/),
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe("paid join card", () => {
  it("uses one FT transfer call amount and refreshes only after the receipt", async () => {
    join.mockResolvedValue({ transactionHash: "tx-join", receiptIds: ["r"] })
    isMember.mockResolvedValue(true)
    render(<GroupJoinCard groupId={3} />)

    expect(screen.getByText(/付费进群只买成员资格/)).toBeInTheDocument()
    expect(screen.getByText("1 入群币")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /支付 1 入群币并加入/ }))

    await waitFor(() => expect(join).toHaveBeenCalledWith("1000000"))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    await waitFor(() => expect(isMember).toHaveBeenCalledWith(3, "bob.testnet"))
  })

  it("submits a human custom amount as exact base units", async () => {
    join.mockResolvedValue({ transactionHash: "tx-join", receiptIds: ["r"] })
    isMember.mockResolvedValue(true)
    render(<GroupJoinCard groupId={3} />)

    fireEvent.change(screen.getByLabelText(/支付数量/), {
      target: { value: "1.25" },
    })
    fireEvent.click(screen.getByRole("button", { name: /支付 1.25 入群币并加入/ }))

    await waitFor(() => expect(join).toHaveBeenCalledWith("1250000"))
  })

  it("does not claim membership while the chain read stays false", async () => {
    join.mockResolvedValue({ transactionHash: "tx-join", receiptIds: ["r"] })
    isMember.mockResolvedValue(false)
    render(<GroupJoinCard groupId={3} />)

    fireEvent.click(screen.getByRole("button", { name: /支付 1 入群币并加入/ }))
    await waitFor(() => expect(join).toHaveBeenCalled())
    expect(screen.queryByText(/已确认入群/)).not.toBeInTheDocument()
  })

  it("shows membership after a confirmed chain refresh", () => {
    groupState = {
      ...groupState,
      members: ["alice.testnet", "bob.testnet"],
      group: { ...(groupState.group as object), member_count: 2 },
    }
    render(<GroupJoinCard groupId={3} />)
    expect(screen.getByText("你已经是这个群的成员。")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "进入群聊" })).toHaveAttribute(
      "href",
      "/groups/3/chat",
    )
    expect(
      screen.queryByRole("button", { name: /支付 1 入群币并加入/ }),
    ).not.toBeInTheDocument()
  })

  it("does not claim membership from wallet submission alone", () => {
    render(<GroupJoinCard groupId={3} />)
    expect(screen.queryByText("你已经是这个群的成员。")).not.toBeInTheDocument()
  })
})
