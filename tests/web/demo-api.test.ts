// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"
import { KeyPair } from "near-api-js"

import { GET as listAccounts } from "@/app/api/demo/accounts/route"
import { POST as createDemo } from "@/app/api/demo/create/route"
import { POST as fetchKeypair } from "@/app/api/demo/keypair/route"
import {
  DemoApiError,
  createFundedDemoAccount,
  guardDemoRequest,
  listDemoAccountIds,
  type DemoCredentialsFs,
} from "@/lib/near/demo-server"
import { runRefill } from "@/scripts/gas-reserve.mjs"

const KEY_PREFIX = ["ed", "25519:"].join("")
const TEST_KEYPAIR = KeyPair.fromRandom("ed25519")
const VALID_PRIVATE_KEY = TEST_KEYPAIR.toString()
const VALID_PUBLIC_KEY = TEST_KEYPAIR.getPublicKey().toString()

const RESERVE_KEYPAIR = KeyPair.fromRandom("ed25519")
const RESERVE_ACCOUNT_ID = "gv-gas-reserve.testnet"

function guardedRequest(
  path = "/api/demo/accounts",
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://127.0.0.1:3100${path}`, {
    headers: {
      host: "127.0.0.1:3100",
      "x-gv-demo": "1",
      ...headers,
    },
  })
}

function memoryCredentialsFs(files: Record<string, string>): {
  fs: DemoCredentialsFs
  writes: string[]
  writtenData: { filePath: string; data: string; mode: number }[]
  chmods: { filePath: string; mode: number }[]
} {
  const writes: string[] = []
  const writtenData: { filePath: string; data: string; mode: number }[] = []
  const chmods: { filePath: string; mode: number }[] = []
  return {
    writes,
    writtenData,
    chmods,
    fs: {
      readdir: async () => Object.keys(files).map((file) => file.split("/").pop()!),
      readFile: async (filePath) => {
        const key = filePath.split("/").pop()!
        const value = files[key]
        if (value === undefined) {
          const error = new Error("not found") as NodeJS.ErrnoException
          error.code = "ENOENT"
          throw error
        }
        return value
      },
      mkdir: async () => undefined,
      writeFile: async (filePath, data, options) => {
        writes.push(filePath)
        writtenData.push({ filePath, data, mode: options.mode })
      },
      chmod: async (filePath, mode) => {
        chmods.push({ filePath, mode })
      },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("demo API localhost guard", () => {
  it("allows only the local demo origin with the custom header", () => {
    expect(guardDemoRequest(guardedRequest(), "testnet")).toEqual({ ok: true })
    expect(
      guardDemoRequest(
        guardedRequest("/api/demo/accounts", { host: "localhost:3100" }),
        "testnet",
      ),
    ).toEqual({ ok: true })
  })

  it("rejects a wrong host with 403", async () => {
    const guard = guardDemoRequest(
      guardedRequest("/api/demo/accounts", { host: "evil.example:3100" }),
      "testnet",
    )
    expect(guard).toMatchObject({ ok: false, status: 403 })

    const response = await listAccounts(
      guardedRequest("/api/demo/accounts", { host: "evil.example:3100" }),
    )
    expect(response.status).toBe(403)

    const createResponse = await createDemo(
      guardedRequest("/api/demo/create", { host: "evil.example:3100" }),
    )
    expect(createResponse.status).toBe(403)

    const keypairResponse = await fetchKeypair(
      new Request("http://127.0.0.1:3100/api/demo/keypair", {
        method: "POST",
        headers: {
          host: "evil.example:3100",
          "x-gv-demo": "1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ accountId: "alpha.testnet" }),
      }),
    )
    expect(keypairResponse.status).toBe(403)
  })

  it("rejects a missing x-gv-demo header with 403", async () => {
    const request = new Request("http://127.0.0.1:3100/api/demo/accounts", {
      headers: { host: "127.0.0.1:3100" },
    })
    const guard = guardDemoRequest(request, "testnet")
    expect(guard).toMatchObject({ ok: false, status: 403 })
    expect((await listAccounts(request)).status).toBe(403)

    const keypairResponse = await fetchKeypair(
      new Request("http://127.0.0.1:3100/api/demo/keypair", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3100",
          "content-type": "application/json",
        },
        body: JSON.stringify({ accountId: "alpha.testnet" }),
      }),
    )
    expect(keypairResponse.status).toBe(403)

    const createResponse = await createDemo(
      new Request("http://127.0.0.1:3100/api/demo/create", {
        method: "POST",
        headers: { host: "127.0.0.1:3100" },
      }),
    )
    expect(createResponse.status).toBe(403)
  })

  it("hard-disables every demo route on mainnet", async () => {
    const request = guardedRequest("/api/demo/create")
    expect(guardDemoRequest(request, "mainnet")).toMatchObject({
      ok: false,
      status: 403,
    })
    const previous = process.env.NEXT_PUBLIC_NEAR_NETWORK
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "mainnet"
    try {
      const response = await createDemo(request)
      expect(response.status).toBe(403)
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_NEAR_NETWORK
      } else {
        process.env.NEXT_PUBLIC_NEAR_NETWORK = previous
      }
    }
  })
})

describe("demo account discovery", () => {
  it("returns account IDs only and skips malformed or mismatched files", async () => {
    const { fs } = memoryCredentialsFs({
      "alpha.testnet.json": JSON.stringify({
        account_id: "alpha.testnet",
        public_key: VALID_PUBLIC_KEY,
        private_key: VALID_PRIVATE_KEY,
      }),
      "zeta.testnet.json": JSON.stringify({
        account_id: "zeta.testnet",
        public_key: VALID_PUBLIC_KEY,
        private_key: VALID_PRIVATE_KEY,
      }),
      [`${"a".repeat(64)}.json`]: JSON.stringify({
        account_id: "a".repeat(64),
        public_key: VALID_PUBLIC_KEY,
        private_key: VALID_PRIVATE_KEY,
      }),
      "mismatch.testnet.json": JSON.stringify({
        account_id: "other.testnet",
        private_key: VALID_PRIVATE_KEY,
      }),
      "broken.json": "{not json",
      "notes.txt": "ignore me",
    })

    const accounts = await listDemoAccountIds(fs, "/home/demo/.near-credentials/testnet")
    expect(accounts).toEqual([
      "a".repeat(64),
      "alpha.testnet",
      "zeta.testnet",
    ])
    expect(accounts.join(" ")).not.toContain(KEY_PREFIX)
  })
})

describe("gas reserve refill script", () => {
  it("refill no-op at target (exit 0 no-op when reserve balance >= target)", async () => {
    const logs: Record<string, unknown>[] = []
    const sweepTransfer = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        jsonrpc: "2.0",
        id: "gas-reserve-query",
        result: { amount: "40000000000000000000000000" }, // 40 NEAR
      }),
    )

    const result = await runRefill({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      targetN: 40,
      sweepTransfer,
      logAppend: async (entry: Record<string, unknown>) => {
        logs.push(entry)
      },
    })

    expect(result.ok).toBe(true)
    expect(result.noop).toBe(true)
    expect(result.balanceN).toBe(40)
    expect(sweepTransfer).not.toHaveBeenCalled()
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "refill_noop",
        balanceN: 40,
        target: 40,
        ok: true,
      }),
    )
  })

  it("claim-failure honesty (mock fetch reject → exits nonzero, no fake sweep)", async () => {
    const logs: Record<string, unknown>[] = []
    const sweepTransfer = vi.fn()
    const fetchImpl = vi.fn((url: string) => {
      if (url.includes("helper.testnet.near.org")) {
        return Promise.reject(new Error("system proxy unreachable"))
      }
      // RPC check: reserve has 10 NEAR (< 40)
      return Promise.resolve(
        Response.json({
          jsonrpc: "2.0",
          id: "gas-reserve-query",
          result: { amount: "10000000000000000000000000" },
        }),
      )
    })

    const result = await runRefill({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      targetN: 40,
      credentialsDir: "/tmp/mock-creds",
      sweepTransfer,
      throwOnError: false,
      logAppend: async (entry: Record<string, unknown>) => {
        logs.push(entry)
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain("system proxy unreachable")
    expect(sweepTransfer).not.toHaveBeenCalled()
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "claim_error",
        ok: false,
        error: expect.stringContaining("system proxy unreachable"),
      }),
    )
  })
})

describe("one-click demo account honesty & fallback", () => {
  it("returns the new keypair with source:faucet when faucet succeeds and saves 0600", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValue(
        Response.json({
          jsonrpc: "2.0",
          id: "gv-demo-onboarding",
          result: { amount: "10000000000000000000000000" },
        }),
      )
    const { fs, writes, writtenData, chmods } = memoryCredentialsFs({})

    const created = await createFundedDemoAccount({
      fetchImpl: fetchImpl as typeof fetch,
      fs,
      directory: "/tmp/gv-demo-test",
      now: () => 0,
      sleep: async () => undefined,
      timeoutMs: 5_000,
      intervalMs: 10,
    })

    expect(created.funded).toBe(true)
    expect(created.source).toBe("faucet")
    expect(created.accountId).toMatch(/^gv-demo-[a-f0-9]{12}\.testnet$/)
    expect(created.privateKey.startsWith(KEY_PREFIX)).toBe(true)
    expect(writes).toEqual([
      `/tmp/gv-demo-test/${created.accountId}.json`,
    ])
    expect(writtenData[0]?.mode).toBe(0o600)
    expect(JSON.parse(writtenData[0]!.data)).toMatchObject({
      account_id: created.accountId,
      private_key: created.privateKey,
    })
    expect(chmods).toEqual([
      { filePath: writes[0], mode: 0o600 },
    ])
  })

  it("create-route fallback: mock faucet fail → reserve create called with 3N", async () => {
    const logs: Record<string, unknown>[] = []
    const reserveCreateAccount = vi.fn().mockResolvedValue(undefined)
    const fetchImpl = vi.fn((url: string) => {
      if (url.includes("helper.testnet.near.org")) {
        return Promise.reject(new Error("faucet unavailable"))
      }
      // RPC balance query for reserve account: returns 10N
      return Promise.resolve(
        Response.json({
          jsonrpc: "2.0",
          id: "gv-demo-balance",
          result: { amount: "10000000000000000000000000" },
        }),
      )
    })

    const { fs, writes, writtenData, chmods } = memoryCredentialsFs({
      [`${RESERVE_ACCOUNT_ID}.json`]: JSON.stringify({
        account_id: RESERVE_ACCOUNT_ID,
        public_key: RESERVE_KEYPAIR.getPublicKey().toString(),
        private_key: RESERVE_KEYPAIR.toString(),
      }),
    })

    const created = await createFundedDemoAccount({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fs,
      directory: "/tmp/gv-demo-test",
      reserveAccount: RESERVE_ACCOUNT_ID,
      grantN: 3,
      reserveCreateAccount,
      logAppend: async (entry) => {
        logs.push(entry)
      },
    })

    expect(created.funded).toBe(true)
    expect(created.source).toBe("reserve")
    expect(created.accountId).toMatch(/^gv-demo-[a-f0-9]{12}\.testnet$/)
    expect(created.privateKey.startsWith(KEY_PREFIX)).toBe(true)

    // Reserve account signed createAccount for 3N (3_000_000_000_000_000_000_000_000n)
    expect(reserveCreateAccount).toHaveBeenCalledTimes(1)
    const callArgs = reserveCreateAccount.mock.calls[0]![0]
    expect(callArgs.reserveAccount).toBe(RESERVE_ACCOUNT_ID)
    expect(callArgs.newAccountId).toBe(created.accountId)
    expect(callArgs.grantYocto).toBe(3_000_000_000_000_000_000_000_000n)

    // Credential written 0600
    expect(writes).toEqual([`/tmp/gv-demo-test/${created.accountId}.json`])
    expect(writtenData[0]?.mode).toBe(0o600)
    expect(chmods).toEqual([{ filePath: writes[0], mode: 0o600 }])

    // Log recorded grant 3N
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "grant",
        from: RESERVE_ACCOUNT_ID,
        to: created.accountId,
        amountN: 3,
        ok: true,
      }),
    )
  })

  it("create-route fallback: reserve low (< grant + 0.5N buffer) → 503 honest error", async () => {
    const logs: Record<string, unknown>[] = []
    const reserveCreateAccount = vi.fn()
    const fetchImpl = vi.fn((url: string) => {
      if (url.includes("helper.testnet.near.org")) {
        return Promise.reject(new Error("faucet unavailable"))
      }
      // RPC returns 2N (< 3.5N needed buffer)
      return Promise.resolve(
        Response.json({
          jsonrpc: "2.0",
          id: "gv-demo-balance",
          result: { amount: "2000000000000000000000000" },
        }),
      )
    })

    const { fs, writes } = memoryCredentialsFs({
      [`${RESERVE_ACCOUNT_ID}.json`]: JSON.stringify({
        account_id: RESERVE_ACCOUNT_ID,
        public_key: RESERVE_KEYPAIR.getPublicKey().toString(),
        private_key: RESERVE_KEYPAIR.toString(),
      }),
    })

    await expect(
      createFundedDemoAccount({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        fs,
        directory: "/tmp/gv-demo-test",
        reserveAccount: RESERVE_ACCOUNT_ID,
        grantN: 3,
        reserveCreateAccount,
        logAppend: async (entry) => {
          logs.push(entry)
        },
      }),
    ).rejects.toMatchObject({
      name: "DemoApiError",
      status: 503,
      funded: false,
      source: "reserve",
      reason: "insufficient",
      message: "储备不足，请稍后再试或手动贴 key",
    } satisfies Partial<DemoApiError>)

    expect(reserveCreateAccount).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "refuse_insufficient",
        ok: false,
      }),
    )
  })

  it("POST /api/demo/create route returns 503 honest payload on reserve insufficient", async () => {
    // Stub fetch so helper fails AND reserve balance is low
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("helper.testnet.near.org")) {
          return Promise.reject(new Error("faucet down"))
        }
        return Promise.resolve(
          Response.json({
            jsonrpc: "2.0",
            id: "gv-demo-balance",
            result: { amount: "1000000000000000000000000" }, // 1 NEAR (< 3.5N)
          }),
        )
      }),
    )

    const response = await createDemo(guardedRequest("/api/demo/create"))
    expect(response.status).toBe(503)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      funded: false,
      source: "reserve",
      reason: "insufficient",
      error: "储备不足，请稍后再试或手动贴 key",
    })
  })
})
