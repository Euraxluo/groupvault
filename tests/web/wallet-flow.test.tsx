import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const connect = vi.fn()
const disconnect = vi.fn()
let walletState = {
  ready: true,
  accountId: null as string | null,
  error: null as string | null,
  connecting: false,
}

vi.mock("@/hooks/use-near-wallet", () => ({
  useNearWallet: () => ({
    ...walletState,
    connect,
    disconnect,
  }),
}))

import { ConnectWalletDialog, shortAccount } from "@/components/connect-wallet-dialog"

describe("copied shell wallet dialog", () => {
  it("shows the disconnected wallet boundary without Sui affordances", () => {
    walletState = { ready: true, accountId: null, error: null, connecting: false }
    render(<ConnectWalletDialog open onOpenChange={() => {}} />)

    expect(screen.getByText(/No wallet connected/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeEnabled()
    expect(screen.queryByText(/zkLogin|passkey|Sui Wallet/i)).not.toBeInTheDocument()
  })

  it("renders the restored selector session", async () => {
    walletState = {
      ready: true,
      accountId: "alice.testnet",
      error: null,
      connecting: false,
    }
    render(<ConnectWalletDialog open onOpenChange={() => {}} />)

    await waitFor(() =>
      expect(screen.getByText("alice.testnet")).toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: /Disconnect/i })).toBeInTheDocument()
  })

  it("surfaces a wallet error instead of pretending to sign", () => {
    walletState = {
      ready: true,
      accountId: null,
      error: "Wallet rejected the connection",
      connecting: false,
    }
    render(<ConnectWalletDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByText(/Wallet rejected the connection/i),
    ).toBeInTheDocument()
  })

  it("truncates long account ids for the navbar", () => {
    expect(shortAccount("alice.testnet")).toBe("alice.testnet")
    expect(shortAccount("a-very-long-account-name.testnet")).toBe("a-very-l…estnet")
  })
})
