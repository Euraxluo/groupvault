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

const KEY_PREFIX = ["ed", "25519:"].join("")
const TEST_KEYPAIR = KeyPair.fromRandom("ed25519")
const VALID_PRIVATE_KEY = TEST_KEYPAIR.toString()
const VALID_PUBLIC_KEY = TEST_KEYPAIR.getPublicKey().toString()

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

describe("one-click demo account honesty", () => {
  it("surfaces a faucet network failure as funded:false with no credential write", async () => {
    const { fs, writes } = memoryCredentialsFs({})
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("system proxy unavailable")),
    )

    const response = await createDemo(guardedRequest("/api/demo/create"))
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      funded: false,
      error: expect.stringContaining("水龙头暂不可用"),
    })

    await expect(
      createFundedDemoAccount({
        fetchImpl: vi.fn().mockRejectedValue(new Error("system proxy unavailable")) as unknown as typeof fetch,
        fs,
        directory: "/tmp/gv-demo-test",
      }),
    ).rejects.toMatchObject({ funded: false })
    expect(writes).toHaveLength(0)
  })

  it("never reports success when the account never appears on RPC", async () => {
    let clock = 0
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValue(
        Response.json({ jsonrpc: "2.0", id: "gv-demo-onboarding", result: null }),
      )
    const { fs, writes } = memoryCredentialsFs({})

    await expect(
      createFundedDemoAccount({
        fetchImpl: fetchImpl as typeof fetch,
        fs,
        directory: "/tmp/gv-demo-test",
        now: () => clock,
        sleep: async (milliseconds) => {
          clock += milliseconds
        },
        timeoutMs: 5_000,
        intervalMs: 2_000,
      }),
    ).rejects.toMatchObject({
      name: "DemoApiError",
      funded: false,
      message: "水龙头暂不可用，请重试或手动贴 key",
    } satisfies Partial<DemoApiError>)
    expect(writes).toHaveLength(0)
  })

  it("returns the new keypair only after RPC confirms and saves it as 0600", async () => {
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

    const helperCall = fetchImpl.mock.calls[0]
    expect(helperCall?.[0]).toBe("https://helper.testnet.near.org/account")
    const helperBody = JSON.parse(
      String((helperCall?.[1] as RequestInit | undefined)?.body),
    ) as { newAccountId: string; newAccountPublicKey: string }
    expect(helperBody.newAccountId).toBe(created.accountId)
    expect(helperBody.newAccountPublicKey.startsWith(KEY_PREFIX)).toBe(true)

    const rpcCall = fetchImpl.mock.calls[1]
    expect(rpcCall?.[0]).toBe("https://testnet-rpc.intea.rs")
    expect(JSON.parse(String((rpcCall?.[1] as RequestInit | undefined)?.body)))
      .toMatchObject({
        method: "query",
        params: {
          request_type: "view_account",
          account_id: created.accountId,
        },
      })
  })
})
