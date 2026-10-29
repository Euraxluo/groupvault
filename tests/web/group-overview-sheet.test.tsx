import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { tipMember, refresh } = vi.hoisted(() => ({
  tipMember: vi.fn(),
  refresh: vi.fn(),
}))
let groupState: Record<string, unknown>
let walletState: Record<string, unknown>

vi.mock("@/hooks/use-near-wallet", () => ({
  useNearWallet: () => walletState,
}))

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => ({ selector: {}, modal: {} }),
}))

vi.mock("@/hooks/use-group-vault", () => ({
  useGroupVault: () => groupState,
}))

vi.mock("@/lib/near/treasury", () => ({
  tipMember,
}))

import { GroupOverviewSheet } from "@/components/group-overview-sheet"

const owner = "gv-a-1024-210252.testnet"
const memberB = "gv-b-1024-210252.testnet"
const memberC = "gv-c-1024-210252.testnet"

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: 16,
    owner,
    name: "Mobile3 sxqh5",
    description: "真实付费群",
    join_fee: "1000000",
    join_ft: "ft.testnet",
    member_count: 3,
    dao_id: null,
    convert_pending: false,
    created_at: 1,
    ...overrides,
  }
}

function setup(nextGroup: Record<string, unknown>, nextMembers = [owner, memberB, memberC]) {
  groupState = {
    ready: true,
    loading: false,
    error: null,
    group: nextGroup,
    members: nextMembers,
    refresh,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  tipMember.mockResolvedValue({ transactionHash: "tx-tip", receiptIds: ["r"] })
  walletState = {
    ready: true,
    accountId: owner,
    error: null,
    connecting: false,
  }
  setup(group())
})

describe("group overview sheet", () => {
  it("shows owner, members, human fee and owner-only convert", () => {
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    expect(screen.getByRole("heading", { name: "Mobile3 sxqh5" })).toBeInTheDocument()
    expect(screen.getByText("1 入群币")).toBeInTheDocument()
    expect(screen.queryByText("1000000")).not.toBeInTheDocument()
    expect(screen.getAllByText("群主").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /升级为 DAO/ })).toHaveAttribute(
      "href",
      "/groups/16/convert",
    )
    expect(screen.queryByRole("link", { name: "金库与投票" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /回到群聊/ })).toHaveAttribute(
      "href",
      "/groups/16/chat",
    )
  })

  it("keeps self tip disabled as 自己 and offers B/C tips", () => {
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    expect(screen.getByRole("button", { name: "Cannot tip yourself" })).toBeDisabled()
    expect(screen.getByText("自己")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: `Tip ${memberB}` }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: `Tip ${memberC}` }),
    ).toBeEnabled()
  })

  it("calls the unchanged Tip adapter for another member", async () => {
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: `Tip ${memberB}` }))
    await waitFor(() =>
      expect(tipMember).toHaveBeenCalledWith(
        expect.anything(),
        owner,
        memberB,
        "10000000000000000000000",
      ),
    )
    expect(tipMember).not.toHaveBeenCalledWith(
      expect.anything(),
      owner,
      owner,
      expect.anything(),
    )
  })

  it("offers the paid join route to a non-member who is not the owner", () => {
    walletState = {
      ready: true,
      accountId: "visitor.testnet",
      error: null,
      connecting: false,
    }
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    expect(screen.getByRole("link", { name: /加入群/ })).toHaveAttribute(
      "href",
      "/groups/16/join",
    )
    expect(screen.queryByRole("link", { name: /升级为 DAO/ })).not.toBeInTheDocument()
  })

  it("routes a converted GROUP to its DAO treasury hub", () => {
    setup(group({ dao_id: "gv16-8jh4.sputnikv2.testnet", member_count: 4 }))
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    expect(screen.getByText(/已是 DAO/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /金库与投票/ })).toHaveAttribute(
      "href",
      "/dao/gv16-8jh4.sputnikv2.testnet",
    )
    expect(screen.getByRole("link", { name: "金库" })).toHaveAttribute(
      "href",
      "/dao/gv16-8jh4.sputnikv2.testnet/treasury",
    )
    expect(screen.getByRole("link", { name: "提案" })).toHaveAttribute(
      "href",
      "/dao/gv16-8jh4.sputnikv2.testnet/proposals",
    )
    expect(screen.getByRole("link", { name: "质押" })).toHaveAttribute(
      "href",
      "/dao/gv16-8jh4.sputnikv2.testnet/stake",
    )
    expect(screen.queryByRole("link", { name: /升级为 DAO/ })).not.toBeInTheDocument()
  })

  it("renders loading and real error states", () => {
    groupState = {
      ready: true,
      loading: true,
      error: null,
      group: null,
      members: [],
      refresh,
    }
    const { rerender } = render(
      <GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />,
    )
    expect(screen.getByText("正在读取群概况…")).toBeInTheDocument()

    groupState = {
      ready: true,
      loading: false,
      error: "NEAR RPC get_group failed: HTTP 429",
      group: null,
      members: [],
      refresh,
    }
    rerender(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)
    expect(screen.getByText("群概况读取失败")).toBeInTheDocument()
    expect(screen.getByText(/HTTP 429/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /重试/ }))
    expect(refresh).toHaveBeenCalled()
  })

  it("expands the roster beyond the preview without a nested dialog", () => {
    const many = [owner, "m1.testnet", "m2.testnet", "m3.testnet", "m4.testnet", memberB]
    setup(group({ member_count: many.length }), many)
    render(<GroupOverviewSheet groupId={16} open onOpenChange={() => {}} />)

    expect(screen.queryByText(memberB)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /查看全部 6 位/ }))
    expect(screen.getByText("m4.testnet")).toBeInTheDocument()
    expect(screen.getByText(memberB)).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: /成员/ })).not.toBeInTheDocument()
  })
})
