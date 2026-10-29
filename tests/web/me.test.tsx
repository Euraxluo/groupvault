import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const accountBalance = vi.fn()
const disconnect = vi.fn()
let walletState: {
  ready: boolean
  accountId: string | null
  error: string | null
  connecting: boolean
} = {
  ready: true,
  accountId: null,
  error: null,
  connecting: false,
}

vi.mock("@/hooks/use-near-wallet", () => ({
  useNearWallet: () => ({
    ...walletState,
    keypairMode: false,
    connect: vi.fn(),
    connectKeypair: vi.fn(),
    disconnect,
  }),
}))

vi.mock("@/components/mobile-navbar", () => ({
  MobileNavbar: () => null,
}))

vi.mock("@/lib/near/rpc", () => ({
  NearRpc: class {
    accountBalance = accountBalance
  },
}))

import MePage from "@/app/me/page"

describe("my account page", () => {
  beforeEach(() => {
    accountBalance.mockReset()
    disconnect.mockReset()
  })

  it("shows an honest disconnected state with testnet and QR entry", () => {
    walletState = { ready: true, accountId: null, error: null, connecting: false }
    render(<MePage />)

    expect(screen.getByRole("heading", { level: 1, name: "我的" })).toBeInTheDocument()
    expect(screen.getByText("未连接")).toBeInTheDocument()
    expect(screen.getByText("testnet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /我的二维码/ })).toHaveAttribute(
      "href",
      "/me/qr",
    )
    expect(screen.getByRole("button", { name: /连接钱包/ })).toBeInTheDocument()
    expect(accountBalance).not.toHaveBeenCalled()
  })

  it("renders the real chain balance through the human formatter", async () => {
    walletState = {
      ready: true,
      accountId: "alice.testnet",
      error: null,
      connecting: false,
    }
    accountBalance.mockResolvedValue(5_500_000_000_000_000_000_000_000n)
    render(<MePage />)

    await waitFor(() =>
      expect(screen.getByText("5.5 NEAR")).toBeInTheDocument(),
    )
    expect(screen.getByText("alice.testnet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /断开钱包/ })).toBeInTheDocument()
  })

  it("shows balance unavailable plus the real error instead of zero", async () => {
    walletState = {
      ready: true,
      accountId: "alice.testnet",
      error: null,
      connecting: false,
    }
    accountBalance.mockRejectedValue(new Error("NEAR RPC query failed: HTTP 429"))
    render(<MePage />)

    await waitFor(() =>
      expect(screen.getByText("余额暂不可用")).toBeInTheDocument(),
    )
    expect(screen.getByText(/HTTP 429/)).toBeInTheDocument()
    expect(screen.queryByText(/0 NEAR/)).not.toBeInTheDocument()
  })
})
