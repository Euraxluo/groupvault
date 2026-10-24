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
    create.mockResolvedValue({ transactionHash: "tx-create", receiptIds: ["r"] })
    render(<CreateGroupDialog open onOpenChange={() => {}} />)

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Builders" } })
    fireEvent.change(screen.getByLabelText("Join fee (FT base units)"), {
      target: { value: "1000000" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Create group/i }))

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
    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups"))
  })

  it("blocks an empty group name before opening the wallet", async () => {
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Create group/i }))
    expect(await screen.findByText(/Group name is required/i)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it("does not navigate when the wallet rejects", async () => {
    create.mockRejectedValue(new Error("User rejected"))
    hookState = { error: "User rejected" }
    render(<CreateGroupDialog open onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Builders" } })
    fireEvent.click(screen.getByRole("button", { name: /Create group/i }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })
})

describe("paid join card", () => {
  it("uses one FT transfer call amount and refreshes only after the receipt", async () => {
    join.mockResolvedValue({ transactionHash: "tx-join", receiptIds: ["r"] })
    render(<GroupJoinCard groupId={3} />)

    expect(screen.getByText(/Paid membership is not voting weight/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Pay and join/i }))

    await waitFor(() => expect(join).toHaveBeenCalledWith("1000000"))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("shows membership after a confirmed chain refresh", () => {
    groupState = {
      ...groupState,
      members: ["alice.testnet", "bob.testnet"],
      group: { ...(groupState.group as object), member_count: 2 },
    }
    render(<GroupJoinCard groupId={3} />)
    expect(screen.getByText(/You are a member/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay and join/i })).not.toBeInTheDocument()
  })

  it("does not claim membership from wallet submission alone", () => {
    render(<GroupJoinCard groupId={3} />)
    expect(screen.queryByText(/You are a member/i)).not.toBeInTheDocument()
  })
})
