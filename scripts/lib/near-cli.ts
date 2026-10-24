import { execFileSync } from "node:child_process"

export interface NearRunResult {
  stdout: string
  stderr: string
}

export function near(args: string[], options: { allowFailure?: boolean } = {}): NearRunResult {
  try {
    const stdout = execFileSync("near", args, {
      encoding: "utf8",
      env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { stdout, stderr: "" }
  } catch (error) {
    const failure = error as {
      stdout?: string
      stderr?: string
      status?: number
      message?: string
    }
    const message = `${failure.stderr ?? ""}${failure.stdout ?? ""}${failure.message ?? ""}`
    if (options.allowFailure) {
      return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? message }
    }
    throw new Error(`near ${args[0]} failed: ${message.slice(0, 2000)}`)
  }
}

const RPC_URL =
  process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com"

async function rpcCall<T>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "groupvault-deploy",
      method,
      params,
    }),
  })
  if (!response.ok) {
    throw new Error(`NEAR RPC ${method} returned HTTP ${response.status}`)
  }
  const body = (await response.json()) as {
    result?: T
    error?: { message?: string }
  }
  if (body.error) {
    throw new Error(`NEAR RPC ${method}: ${body.error.message ?? "unknown error"}`)
  }
  return body.result as T
}

export function accountExists(accountId: string): boolean {
  const result = near(["state", accountId], { allowFailure: true })
  return !/does not exist|AccountDoesNotExist/i.test(result.stderr + result.stdout)
}

export function createFaucetAccount(accountId: string): void {
  if (accountExists(accountId)) {
    console.log(`[deploy] reusing account ${accountId}`)
    return
  }
  console.log(`[deploy] creating funded testnet account ${accountId}`)
  near(["create-account", accountId, "--useFaucet"])
}

export function transactionHash(output: string): string {
  // near-cli 4.x prints "Transaction Id <hash>" without a colon.
  const match = /Transaction Id:?\s+([1-9A-HJ-NP-Za-km-z]{32,})/.exec(output)
  if (!match) {
    throw new Error("Could not find a transaction hash in near CLI output")
  }
  return match[1]!
}

export function deployContract(input: {
  accountId: string
  wasmPath: string
  initFunction?: string
  initArgs?: Record<string, unknown>
}): string {
  const args = ["deploy", input.accountId, input.wasmPath]
  if (input.initFunction) {
    args.push(
      "--initFunction",
      input.initFunction,
      "--initArgs",
      JSON.stringify(input.initArgs ?? {}),
      "--initGas",
      "100000000000000",
    )
  }
  return transactionHash(near(args).stdout)
}

export function call(input: {
  accountId: string
  contractId: string
  methodName: string
  args?: Record<string, unknown>
  deposit?: string
  gas?: string
}): string {
  const args = [
    "call",
    input.contractId,
    input.methodName,
    JSON.stringify(input.args ?? {}),
    "--accountId",
    input.accountId,
    "--gas",
    input.gas ?? "100000000000000",
  ]
  if (input.deposit) args.push("--deposit", input.deposit)
  return transactionHash(near(args).stdout)
}

export async function view<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await rpcCall<{ result: number[] }>("query", {
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
  })
  const text = Buffer.from(result.result ?? []).toString("utf8")
  return JSON.parse(text) as T
}

export async function accountCodeHash(accountId: string): Promise<string> {
  const result = await rpcCall<{ code_hash: string }>("query", {
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })
  return result.code_hash
}
