import { expect, type APIRequestContext } from "@playwright/test"

export const RPC_URL =
  process.env.NEXT_PUBLIC_NEAR_RPC_URL?.trim() ||
  process.env.NEAR_RPC_URL?.trim() ||
  "https://test.rpc.fastnear.com"

const RPC_FALLBACKS = Array.from(
  new Set(
    [
      RPC_URL,
      "https://test.rpc.fastnear.com",
    ].filter(Boolean),
  ),
)

/** Per-request timeout; a dead endpoint must not consume the whole poll budget. */
const RPC_TIMEOUT_MS = 15_000

async function rpc<T>(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  let lastError: string | undefined
  // retries * endpoints stay bounded so a poll can retry again later.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const url of RPC_FALLBACKS) {
      try {
        const response = await request.post(url, {
          data: { jsonrpc: "2.0", id: "groupvault-e2e", method, params },
          timeout: RPC_TIMEOUT_MS,
        })
        if (!response.ok()) {
          lastError = `${url} HTTP ${response.status()} ${await response.text()}`
          await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
          continue
        }
        const body = (await response.json()) as {
          result?: T
          error?: { message?: string }
        }
        if (body.error) {
          lastError = `${url} rpc error: ${body.error.message ?? JSON.stringify(body.error)}`
          await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
          continue
        }
        return body.result as T
      } catch (reason) {
        lastError = `${url} ${reason instanceof Error ? reason.message : String(reason)}`
        await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
      }
    }
  }
  throw new Error(`NEAR RPC failed after retries: ${lastError}`)
}

export async function viewCall<T>(
  request: APIRequestContext,
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await rpc<{ result: number[] }>(request, "query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
  })
  const text = Buffer.from(result.result ?? []).toString("utf8")
  return JSON.parse(text) as T
}

/** Final native NEAR balance, read from chain rather than from the UI. */
export async function nearBalance(
  request: APIRequestContext,
  accountId: string,
): Promise<string> {
  const result = await rpc<{ amount: string }>(request, "query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return result.amount
}

export async function expectMember(
  request: APIRequestContext,
  contractId: string,
  groupId: number,
  accountId: string,
): Promise<void> {
  const member = await viewCall<boolean>(request, contractId, "is_member", {
    group_id: groupId,
    account_id: accountId,
  })
  expect(member).toBe(true)
}

export async function expectDao(
  request: APIRequestContext,
  contractId: string,
  groupId: number,
): Promise<string> {
  let daoId: string | null = null
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    daoId = await viewCall<string | null>(request, contractId, "get_dao_id", {
      group_id: groupId,
    })
    if (typeof daoId === "string" && daoId.length > 0) break
    await new Promise((r) => setTimeout(r, 2000))
  }
  expect(daoId).toMatch(/\.sputnikv2\.testnet$/)
  const policy = await viewCall<{ roles: unknown[] }>(
    request,
    daoId as string,
    "get_policy",
  )
  expect(Array.isArray(policy.roles)).toBe(true)
  return daoId as string
}
