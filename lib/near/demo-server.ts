import { randomBytes } from "node:crypto"
import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { KeyPair } from "near-api-js"

const ALLOWED_HOSTS = new Set(["127.0.0.1:3100", "localhost:3100"])
const HELPER_ACCOUNT_URL = "https://helper.testnet.near.org/account"
const TESTNET_RPC_URL = "https://testnet-rpc.intea.rs"
const ACCOUNT_ID_PATTERN = /^[a-z0-9._-]+$/
const ED25519_PREFIX = ["ed", "25519:"].join("")
const ACCOUNT_POLL_TIMEOUT_MS = 60_000
const ACCOUNT_POLL_INTERVAL_MS = 2_000
const RPC_REQUEST_TIMEOUT_MS = 10_000

export interface DemoCredentialsFs {
  readdir(directory: string): Promise<string[]>
  readFile(filePath: string, encoding: "utf8"): Promise<string>
  mkdir(
    directory: string,
    options: { recursive: true; mode?: number },
  ): Promise<unknown>
  writeFile(
    filePath: string,
    data: string,
    options: { encoding: "utf8"; mode: number; flag: "wx" },
  ): Promise<unknown>
  chmod(filePath: string, mode: number): Promise<unknown>
}

export const nodeDemoCredentialsFs: DemoCredentialsFs = {
  readdir: (directory) => readdir(directory),
  readFile: (filePath, encoding) => readFile(filePath, encoding),
  mkdir: (directory, options) => mkdir(directory, options),
  writeFile: (filePath, data, options) => writeFile(filePath, data, options),
  chmod: (filePath, mode) => chmod(filePath, mode),
}

export class DemoApiError extends Error {
  readonly status: number
  readonly funded?: boolean

  constructor(message: string, status = 400, funded?: boolean) {
    super(message)
    this.name = "DemoApiError"
    this.status = status
    this.funded = funded
  }
}

export type DemoGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Bracket access keeps this server-only check out of Next's compile-time
 * NEXT_PUBLIC_* inlining, so a mainnet build cannot be flipped back on by a
 * stale testnet bundle.
 */
export function configuredDemoNetwork(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const publicNetwork = env["NEXT_PUBLIC_NEAR_NETWORK"]?.trim()
  const serverNetwork = env["NEAR_NETWORK"]?.trim()
  if (publicNetwork === "mainnet" || serverNetwork === "mainnet") {
    return "mainnet"
  }
  return publicNetwork || serverNetwork || "testnet"
}

export function guardDemoRequest(
  request: Request,
  network = configuredDemoNetwork(),
): DemoGuardResult {
  if (network !== "testnet") {
    return {
      ok: false,
      status: 403,
      error: "演示账号仅在 NEAR testnet 可用",
    }
  }

  const host = request.headers.get("host")?.toLowerCase()
  if (!host || !ALLOWED_HOSTS.has(host)) {
    return {
      ok: false,
      status: 403,
      error: "演示账号接口仅允许本机 3100 端口访问",
    }
  }

  if (request.headers.get("x-gv-demo") !== "1") {
    return {
      ok: false,
      status: 403,
      error: "缺少 x-gv-demo 请求头",
    }
  }

  return { ok: true }
}

export function demoCredentialsDir(): string {
  return (
    process.env.GV_DEMO_CREDENTIALS_DIR?.trim() ||
    path.join(os.homedir(), ".near-credentials", "testnet")
  )
}

export function isValidDemoAccountId(accountId: string): boolean {
  return (
    accountId.length >= 2 &&
    accountId.length <= 64 &&
    ACCOUNT_ID_PATTERN.test(accountId) &&
    !/^[._-]|[._-]$/.test(accountId) &&
    !accountId.includes("..") &&
    !accountId.includes("/") &&
    !accountId.includes("\\")
  )
}

function parseCredential(
  raw: string,
  expectedAccountId?: string,
): { accountId: string; privateKey: string; publicKey: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new DemoApiError("本机凭据文件格式无效", 500)
  }
  if (!parsed || typeof parsed !== "object") {
    throw new DemoApiError("本机凭据文件格式无效", 500)
  }

  const record = parsed as Record<string, unknown>
  const accountId = record.account_id
  const privateKey = record.private_key
  if (
    typeof accountId !== "string" ||
    !isValidDemoAccountId(accountId) ||
    (expectedAccountId !== undefined && accountId !== expectedAccountId) ||
    typeof privateKey !== "string" ||
    !privateKey.startsWith(ED25519_PREFIX)
  ) {
    throw new DemoApiError("本机凭据文件缺少有效的 testnet 账号或私钥", 500)
  }
  try {
    KeyPair.fromString(privateKey as Parameters<typeof KeyPair.fromString>[0])
  } catch {
    throw new DemoApiError("本机凭据文件中的私钥无效", 500)
  }

  return {
    accountId,
    privateKey,
    publicKey:
      typeof record.public_key === "string" ? record.public_key : null,
  }
}

type ReadableCredentialsFs = Pick<DemoCredentialsFs, "readdir" | "readFile">

/**
 * List credential files without exposing anything except account IDs.
 * Corrupt or unrelated JSON files are skipped rather than failing the whole
 * picker.
 */
export async function listDemoAccountIds(
  fs: ReadableCredentialsFs = nodeDemoCredentialsFs,
  directory = demoCredentialsDir(),
): Promise<string[]> {
  let files: string[]
  try {
    files = await fs.readdir(directory)
  } catch (reason) {
    if (
      reason &&
      typeof reason === "object" &&
      "code" in reason &&
      reason.code === "ENOENT"
    ) {
      return []
    }
    throw new DemoApiError("无法读取本机 NEAR 凭据目录", 500)
  }

  const accountIds = new Set<string>()
  for (const file of files) {
    if (!file.endsWith(".json")) continue
    try {
      const credential = parseCredential(
        await fs.readFile(path.join(directory, file), "utf8"),
      )
      if (file === `${credential.accountId}.json`) {
        accountIds.add(credential.accountId)
      }
    } catch {
      // A single malformed key file must not hide the other local accounts.
    }
  }
  return [...accountIds].sort((left, right) => left.localeCompare(right))
}

export async function loadDemoKeypair(
  accountId: string,
  fs: ReadableCredentialsFs = nodeDemoCredentialsFs,
  directory = demoCredentialsDir(),
): Promise<{ accountId: string; privateKey: string }> {
  if (!isValidDemoAccountId(accountId)) {
    throw new DemoApiError("账号 ID 无效", 400)
  }

  let raw: string
  try {
    raw = await fs.readFile(path.join(directory, `${accountId}.json`), "utf8")
  } catch (reason) {
    if (
      reason &&
      typeof reason === "object" &&
      "code" in reason &&
      reason.code === "ENOENT"
    ) {
      throw new DemoApiError("本机不存在该演示账号的凭据", 404)
    }
    throw new DemoApiError("无法读取本机演示账号凭据", 500)
  }

  const credential = parseCredential(raw, accountId)
  return {
    accountId: credential.accountId,
    privateKey: credential.privateKey,
  }
}

async function saveDemoCredential(
  accountId: string,
  privateKey: string,
  publicKey: string,
  fs: DemoCredentialsFs,
  directory: string,
): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 })
    const filePath = path.join(directory, `${accountId}.json`)
    await fs.writeFile(
      filePath,
      `${JSON.stringify(
        {
          account_id: accountId,
          public_key: publicKey,
          private_key: privateKey,
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    )
    await fs.chmod(filePath, 0o600)
  } catch {
    throw new DemoApiError(
      "账号已在链上创建，但本机凭据保存失败；请重试或手动贴 key",
      500,
      true,
    )
  }
}

interface CreateDemoOptions {
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => number
  timeoutMs?: number
  intervalMs?: number
  helperUrl?: string
  rpcUrl?: string
  fs?: DemoCredentialsFs
  directory?: string
}

async function accountIsFunded(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  accountId: string,
): Promise<boolean> {
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "gv-demo-onboarding",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
      signal: AbortSignal.timeout(RPC_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return false
    const payload = (await response.json()) as {
      result?: { amount?: unknown }
    }
    return (
      typeof payload.result?.amount === "string" &&
      BigInt(payload.result.amount) > 0n
    )
  } catch {
    return false
  }
}

export async function createFundedDemoAccount(
  options: CreateDemoOptions = {},
): Promise<{ accountId: string; privateKey: string; funded: true }> {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? ACCOUNT_POLL_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? ACCOUNT_POLL_INTERVAL_MS
  const helperUrl = options.helperUrl ?? HELPER_ACCOUNT_URL
  const rpcUrl = options.rpcUrl ?? TESTNET_RPC_URL
  const fs = options.fs ?? nodeDemoCredentialsFs
  const directory = options.directory ?? demoCredentialsDir()
  const accountId = `gv-demo-${randomBytes(6).toString("hex")}.testnet`
  const keyPair = KeyPair.fromRandom("ed25519")
  const privateKey = keyPair.toString()
  const publicKey = keyPair.getPublicKey().toString()

  let faucetResponse: Response
  try {
    faucetResponse = await fetchImpl(helperUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        newAccountId: accountId,
        newAccountPublicKey: publicKey,
      }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new DemoApiError(
      "水龙头暂不可用，请重试或手动贴 key",
      502,
      false,
    )
  }
  if (!faucetResponse.ok) {
    throw new DemoApiError(
      "水龙头暂不可用，请重试或手动贴 key",
      502,
      false,
    )
  }

  const deadline = now() + timeoutMs
  let confirmed = false
  do {
    if (await accountIsFunded(fetchImpl, rpcUrl, accountId)) {
      confirmed = true
      break
    }
    const remaining = deadline - now()
    if (remaining <= 0) break
    await sleep(Math.min(intervalMs, remaining))
  } while (now() <= deadline)

  if (!confirmed) {
    throw new DemoApiError(
      "水龙头暂不可用，请重试或手动贴 key",
      504,
      false,
    )
  }

  await saveDemoCredential(accountId, privateKey, publicKey, fs, directory)
  return { accountId, privateKey, funded: true }
}

export function demoJson(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers)
  headers.set("cache-control", "no-store")
  return Response.json(body, { ...init, headers })
}
