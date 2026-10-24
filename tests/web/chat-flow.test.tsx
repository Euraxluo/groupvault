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
    expect(screen.getByText(/public on-chain logs/i)).toBeInTheDocument()
    expect(screen.getByText("hello from chain")).toBeInTheDocument()
  })

  it("blocks nonmembers from sending", () => {
    groupState = { ...groupState, members: ["alice.testnet"] }
    render(<GroupChat groupId={3} />)
    expect(screen.getByText(/Only members can send messages/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Write a public message/i)).not.toBeInTheDocument()
  })

  it("enforces the 4096-byte UTF-8 limit before the wallet", () => {
    render(<GroupChat groupId={3} />)
    const box = screen.getByPlaceholderText(/Write a public message/i)
    fireEvent.change(box, { target: { value: "é".repeat(2049) } })
    fireEvent.click(screen.getByRole("button", { name: /^Send$/i }))
    expect(send).not.toHaveBeenCalled()
  })

  it("sends accepted text unchanged and waits for the receipt", async () => {
    send.mockResolvedValue(undefined)
    render(<GroupChat groupId={3} />)
    fireEvent.change(screen.getByPlaceholderText(/Write a public message/i), {
      target: { value: "  hello  " },
    })
    fireEvent.click(screen.getByRole("button", { name: /^Send$/i }))
    await waitFor(() => expect(send).toHaveBeenCalledWith("  hello  "))
  })

  it("shows indexing delay explicitly", () => {
    chatState = { ...chatState, indexing: true }
    render(<GroupChat groupId={3} />)
    expect(screen.getByText(/Indexing…/i)).toBeInTheDocument()
  })
})
