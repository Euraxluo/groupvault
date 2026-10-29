import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const send = vi.fn()
const refresh = vi.fn()
let chatState: Record<string, unknown>
let walletState: Record<string, unknown>
let groupState: Record<string, unknown>

vi.mock("@/hooks/use-near-wallet", () => ({
  useNearWallet: () => walletState,
}))

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => ({ selector: {}, modal: {} }),
}))

vi.mock("@/hooks/use-group-messages", () => ({
  useGroupMessages: () => chatState,
}))

vi.mock("@/hooks/use-group-vault", () => ({
  useGroupVault: () => groupState,
}))

import { GroupChat } from "@/components/group-chat"

beforeEach(() => {
  vi.clearAllMocks()
  walletState = { ready: true, accountId: "bob.testnet", error: null, connecting: false }
  groupState = {
    ready: true,
    loading: false,
    error: null,
    group: { id: 3, name: "Builders", member_count: 2 },
    members: ["alice.testnet", "bob.testnet"],
    refresh: vi.fn(),
  }
  chatState = {
    messages: [
      {
        group_id: 3,
        sender: "alice.testnet",
        text: "hello from chain",
        ts: "1760000000000000000",
        receipt_id: "r1",
        block_height: 10,
        log_index: 1,
      },
    ],
    loading: false,
    indexing: false,
    error: null,
    refresh,
    send,
    sending: false,
  }
})

describe("public chat", () => {
  it("shows the public-log warning and indexer messages", () => {
    render(<GroupChat groupId={3} />)
    expect(screen.getByText(/2 位成员/)).toBeInTheDocument()
    expect(screen.getByText(/无端到端加密/)).toBeInTheDocument()
    expect(screen.getByText("hello from chain")).toBeInTheDocument()
  })

  it("blocks nonmembers from sending", () => {
    groupState = { ...groupState, members: ["alice.testnet"] }
    render(<GroupChat groupId={3} />)
    expect(screen.getByText("付费进群后才能发言")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "付费进群" })).toHaveAttribute(
      "href",
      "/groups/3/join",
    )
    expect(screen.queryByPlaceholderText(/写一条公开消息/)).not.toBeInTheDocument()
  })

  it("does not tell a member to pay while membership is still loading", () => {
    groupState = { ...groupState, loading: true, members: [] }
    render(<GroupChat groupId={3} />)

    expect(screen.getByText("正在确认你的成员身份…")).toBeInTheDocument()
    expect(screen.queryByText("付费进群后才能发言")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "付费进群" })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/写一条公开消息/)).not.toBeInTheDocument()
  })

  it("enforces the 4096-byte UTF-8 limit before the wallet", () => {
    render(<GroupChat groupId={3} />)
    const box = screen.getByPlaceholderText(/写一条公开消息/)
    fireEvent.change(box, { target: { value: "é".repeat(2049) } })
    fireEvent.click(screen.getByRole("button", { name: /^发送$/ }))
    expect(send).not.toHaveBeenCalled()
  })

  it("sends accepted text unchanged and waits for the receipt", async () => {
    send.mockResolvedValue(undefined)
    render(<GroupChat groupId={3} />)
    fireEvent.change(screen.getByPlaceholderText(/写一条公开消息/), {
      target: { value: "  hello  " },
    })
    fireEvent.click(screen.getByRole("button", { name: /^发送$/ }))
    await waitFor(() => expect(send).toHaveBeenCalledWith("  hello  "))
  })

  it("shows indexing delay explicitly", () => {
    chatState = { ...chatState, indexing: true }
    render(<GroupChat groupId={3} />)
    expect(screen.getByText(/索引器同步中/)).toBeInTheDocument()
  })

  it("exposes the group sheet button without changing send behavior", () => {
    const onOpenGroup = vi.fn()
    render(<GroupChat groupId={3} onOpenGroup={onOpenGroup} />)
    fireEvent.click(screen.getByRole("button", { name: "群" }))
    expect(onOpenGroup).toHaveBeenCalledTimes(1)
  })

  it("expands the privacy notice to public log and no-E2E copy", () => {
    render(<GroupChat groupId={3} />)
    fireEvent.click(document.querySelector("[data-privacy-notice]")!)
    expect(screen.getByText(/任何人都能读取/)).toBeInTheDocument()
    expect(screen.getByText(/没有端到端加密/)).toBeInTheDocument()
  })
})
