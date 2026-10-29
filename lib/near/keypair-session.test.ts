import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearDemoKeypairSession,
  getDemoKeypairSession,
  isDemoKeypairActive,
  resetDemoKeypairSessionForTests,
  setDemoKeypairSession,
} from "./keypair-session"

const FAKE_KEY = ["ed", "25519:", "FakeSecretForUnitTestOnly0000000000000000000"].join("")

const signAndSendWithKeypair = vi.fn().mockResolvedValue({
  transactionHash: "kp-tx",
  receiptIds: ["r1"],
})

vi.mock("./keypair-signer", () => ({
  signAndSendWithKeypair: (...args: unknown[]) => signAndSendWithKeypair(...args),
}))

afterEach(() => {
  resetDemoKeypairSessionForTests()
  signAndSendWithKeypair.mockClear()
})

describe("demo keypair session", () => {
  it("stores and clears credentials in memory", () => {
    expect(isDemoKeypairActive()).toBe(false)
    setDemoKeypairSession(
      {
        accountId: "gv-a.testnet",
        privateKey: FAKE_KEY,
      },
      { persist: false },
    )
    expect(isDemoKeypairActive()).toBe(true)
    expect(getDemoKeypairSession()?.accountId).toBe("gv-a.testnet")
    clearDemoKeypairSession()
    expect(isDemoKeypairActive()).toBe(false)
  })

  it("rejects non-ed25519 secrets", () => {
    expect(() =>
      setDemoKeypairSession(
        { accountId: "a.testnet", privateKey: "not-a-key" },
        { persist: false },
      ),
    ).toThrow(/ed25519/)
  })
})

describe("signAndSendTransaction keypair routing", () => {
  beforeEach(() => {
    setDemoKeypairSession(
      {
        accountId: "gv-a.testnet",
        privateKey: FAKE_KEY,
      },
      { persist: false },
    )
  })

  it("routes through the keypair signer when demo session is active", async () => {
    const { signAndSendTransaction } = await import("./actions")
    const walletSign = vi.fn()
    const selector = {
      store: { getState: () => ({ selectedWalletId: "my-near-wallet" }) },
      wallet: async () => ({ signAndSendTransaction: walletSign }),
    }

    const receipt = await signAndSendTransaction(selector as never, "gv-a.testnet", {
      receiverId: "gv.testnet",
      methodName: "send_message",
      args: { group_id: 1, text: "hi" },
      gas: "30000000000000",
    })

    expect(receipt.transactionHash).toBe("kp-tx")
    expect(signAndSendWithKeypair).toHaveBeenCalledWith("gv-a.testnet", {
      receiverId: "gv.testnet",
      methodName: "send_message",
      args: { group_id: 1, text: "hi" },
      gas: "30000000000000",
    })
    expect(walletSign).not.toHaveBeenCalled()
  })
})
