import {
  connect,
  keyStores,
  KeyPair,
  providers,
  type Account,
} from "near-api-js"

import { getNearConfig } from "./config"
import {
  getDemoKeypairSession,
  type DemoKeypairCredentials,
} from "./keypair-session"
import type { FunctionCallInput, SignedReceipt } from "./actions"

interface ExecutionOutcomeLike {
  status?: { SuccessValue?: string; Failure?: unknown } | string
  transaction_outcome?: { id: string }
  transaction?: { hash?: string }
  receipts_outcome?: { id: string }[]
}

let cached:
  | {
      accountId: string
      privateKey: string
      account: Account
    }
  | null = null

function assertTestnetOnly(): void {
  const network = getNearConfig().network
  if (network !== "testnet") {
    throw new Error(
      "Demo keypair signing is testnet-only; refuse to sign on " + network,
    )
  }
}

export async function getDemoAccount(
  credentials?: DemoKeypairCredentials,
): Promise<Account> {
  assertTestnetOnly()
  const session = credentials ?? getDemoKeypairSession()
  if (!session) {
    throw new Error("Demo keypair session is not active")
  }

  if (
    cached &&
    cached.accountId === session.accountId &&
    cached.privateKey === session.privateKey
  ) {
    return cached.account
  }

  const config = getNearConfig()
  const keyStore = new keyStores.InMemoryKeyStore()
  // near-api-js KeyPair.fromString accepts ed25519:… secret keys.
  const keyPair = KeyPair.fromString(
    session.privateKey as Parameters<typeof KeyPair.fromString>[0],
  )
  await keyStore.setKey(config.network, session.accountId, keyPair)
  // Prefer configured RPC, then a public failover — slow single endpoints
  // (Node undici 10s connect timeout) are common on constrained networks.
  // Prefer a responsive public endpoint first — Node undici's 10s connect
  // timeout often trips on rpc.testnet.near.org from constrained networks.
  const urls = Array.from(
    new Set(
      [
        "https://test.rpc.fastnear.com",
        config.rpcUrl,
        "https://rpc.testnet.near.org",
      ].filter(Boolean),
    ),
  )
  const provider =
    urls.length > 1
      ? new providers.FailoverRpcProvider(
          urls.map((url) => new providers.JsonRpcProvider({ url })),
        )
      : new providers.JsonRpcProvider({ url: urls[0]! })
  const near = await connect({
    networkId: config.network,
    nodeUrl: urls[0]!,
    provider,
    keyStore,
  })
  const account = await near.account(session.accountId)
  cached = {
    accountId: session.accountId,
    privateKey: session.privateKey,
    account,
  }
  return account
}

export function clearDemoAccountCache(): void {
  cached = null
}

export function parseFinalExecutionOutcome(
  outcome: ExecutionOutcomeLike,
): SignedReceipt {
  const status = outcome.status
  let successValue: unknown
  if (
    status &&
    typeof status === "object" &&
    typeof status.SuccessValue === "string" &&
    status.SuccessValue.length > 0
  ) {
    try {
      const raw =
        typeof Buffer !== "undefined"
          ? Buffer.from(status.SuccessValue, "base64").toString("utf8")
          : atob(status.SuccessValue)
      successValue = JSON.parse(raw)
    } catch {
      successValue = undefined
    }
  }

  return {
    transactionHash:
      outcome.transaction_outcome?.id ?? outcome.transaction?.hash ?? "",
    receiptIds: (outcome.receipts_outcome ?? []).map((receipt) => receipt.id),
    successValue,
  }
}

export async function signAndSendWithKeypair(
  signerId: string,
  input: FunctionCallInput,
): Promise<SignedReceipt> {
  const session = getDemoKeypairSession()
  if (!session) {
    throw new Error("Demo keypair session is not active")
  }
  if (session.accountId !== signerId) {
    throw new Error(
      `Demo keypair is connected as ${session.accountId}, not ${signerId}`,
    )
  }

  const account = await getDemoAccount(session)
  const outcome = (await account.functionCall({
    contractId: input.receiverId,
    methodName: input.methodName,
    args: input.args ?? {},
    gas: BigInt(input.gas),
    attachedDeposit: BigInt(input.deposit ?? "0"),
  })) as ExecutionOutcomeLike
  return parseFinalExecutionOutcome(outcome)
}

export async function transferWithKeypair(
  signerId: string,
  receiverId: string,
  amount: string,
): Promise<SignedReceipt> {
  const session = getDemoKeypairSession()
  if (!session) {
    throw new Error("Demo keypair session is not active")
  }
  if (session.accountId !== signerId) {
    throw new Error(
      `Demo keypair is connected as ${session.accountId}, not ${signerId}`,
    )
  }
  const account = await getDemoAccount(session)
  const outcome = (await account.sendMoney(
    receiverId,
    BigInt(amount),
  )) as ExecutionOutcomeLike
  return parseFinalExecutionOutcome(outcome)
}
