import { expect, type APIRequestContext } from "@playwright/test"

export const RPC_URL = "https://rpc.testnet.near.org"

async function rpc<T>(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const response = await request.post(RPC_URL, {
    data: { jsonrpc: "2.0", id: "groupvault-e2e", method, params },
  })
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as {
    result?: T
    error?: { message?: string }
  }
  expect(body.error).toBeUndefined()
  return body.result as T
}

export async function viewCall<T>(
  request: APIRequestContext,
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await rpc<{ result: number[] }>(request, "query", {
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
  })
  const text = Buffer.from(result.result ?? []).toString("utf8")
  return JSON.parse(text) as T
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
  const daoId = await viewCall<string | null>(request, contractId, "get_dao_id", {
    group_id: groupId,
  })
  expect(daoId).toMatch(/\.sputnikv2\.testnet$/)
  const policy = await viewCall<{ roles: unknown[] }>(
    request,
    daoId as string,
    "get_policy",
  )
  expect(Array.isArray(policy.roles)).toBe(true)
  return daoId as string
}
