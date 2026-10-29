import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getGroup = vi.fn()
const convertToDao = vi.fn()
const session = {
  selector: {
    store: {
      observable: { subscribe: () => ({ unsubscribe() {} }) },
    },
  },
  modal: {},
  accountId: null,
}

vi.mock("@/hooks/use-near-session", () => ({
  useNearSession: () => session,
}))

vi.mock("@/lib/near/selector", () => ({
  getConnectedAccountId: () => "gv-a-1024-210252.testnet",
}))

vi.mock("@/lib/near/keypair-session", () => ({
  subscribeDemoKeypair: () => () => {},
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

vi.mock("@/lib/near/groupvault", () => ({
  createGroupVaultClient: () => ({ getGroup, convertToDao }),
}))

import { useConvert } from "@/hooks/use-convert"

const owner = "gv-a-1024-210252.testnet"

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    owner,
    name: "Builders",
    description: "",
    join_fee: "1000000",
    join_ft: "ft.testnet",
    member_count: 2,
    dao_id: null,
    convert_pending: false,
    created_at: 1,
    ...overrides,
  }
}

beforeEach(() => {
  getGroup.mockReset()
  convertToDao.mockReset()
  getGroup.mockResolvedValue(group())
  convertToDao.mockResolvedValue({ transactionHash: "tx-convert", receiptIds: ["r"] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("useConvert terminal states", () => {
  it("returns only the chain-confirmed dao_id", async () => {
    getGroup
      .mockResolvedValueOnce(group())
      .mockResolvedValueOnce(group({ convert_pending: true }))
      .mockResolvedValueOnce(group({ dao_id: "builders.sputnikv2.testnet" }))

    const { result } = renderHook(() =>
      useConvert(3, { pollIntervalMs: 5, deadlineMs: 5_000 }),
    )
    await waitFor(() => expect(result.current.group).not.toBeNull())

    let daoId = ""
    await act(async () => {
      daoId = await result.current.submit("builders", "Paid group")
    })

    expect(daoId).toBe("builders.sputnikv2.testnet")
    expect(result.current.group?.dao_id).toBe("builders.sputnikv2.testnet")
    expect(convertToDao).toHaveBeenCalledWith(
      owner,
      3,
      "builders",
      "Paid group",
      "10000000000000000000000000",
    )
  })

  it("throws when pending clears without a dao_id", async () => {
    getGroup
      .mockResolvedValueOnce(group())
      .mockResolvedValueOnce(group({ convert_pending: true }))
      .mockResolvedValueOnce(group())

    const { result } = renderHook(() =>
      useConvert(3, { pollIntervalMs: 5, deadlineMs: 5_000 }),
    )
    await waitFor(() => expect(result.current.group).not.toBeNull())

    let failure: unknown
    await act(async () => {
      try {
        await result.current.submit("builders", "Paid group")
      } catch (reason) {
        failure = reason
      }
    })
    expect(String(failure)).toMatch(/没有写入 DAO/)
    expect(result.current.group?.dao_id).toBeNull()
  })

  it("surfaces a group read failure instead of silent success", async () => {
    let calls = 0
    getGroup.mockImplementation(async () => {
      calls += 1
      if (calls === 1) return group()
      throw new Error("NEAR RPC query failed: HTTP 429")
    })

    const { result } = renderHook(() =>
      useConvert(3, { pollIntervalMs: 5, deadlineMs: 5_000 }),
    )
    await waitFor(() => expect(result.current?.group).not.toBeNull())

    let failure: unknown
    await act(async () => {
      try {
        await result.current.submit("builders", "Paid group")
      } catch (reason) {
        failure = reason
      }
    })
    expect(String(failure)).toMatch(/HTTP 429/)
    expect(result.current.error).toMatch(/HTTP 429/)
  })

  it("throws at the deadline instead of returning an unconfirmed id", async () => {
    getGroup.mockResolvedValue(group())

    const { result } = renderHook(() =>
      useConvert(3, { pollIntervalMs: 5, deadlineMs: 40 }),
    )
    await waitFor(() => expect(result.current.group).not.toBeNull())

    let failure: unknown
    await act(async () => {
      try {
        await result.current.submit("builders", "Paid group")
      } catch (reason) {
        failure = reason
      }
    })

    expect(failure).toBeInstanceOf(Error)
    expect(String(failure)).toMatch(/超时/)
  })

  it("propagates a wallet rejection without changing chain state", async () => {
    convertToDao.mockRejectedValue(new Error("User rejected the transaction"))

    const { result } = renderHook(() =>
      useConvert(3, { pollIntervalMs: 5, deadlineMs: 5_000 }),
    )
    await waitFor(() => expect(result.current.group).not.toBeNull())

    let rejection: unknown
    await act(async () => {
      try {
        await result.current.submit("builders", "Paid group")
      } catch (reason) {
        rejection = reason
      }
    })
    expect(String(rejection)).toMatch(/User rejected/)
    expect(result.current.submitting).toBe(false)
    expect(result.current.group?.dao_id).toBeNull()
  })
})
