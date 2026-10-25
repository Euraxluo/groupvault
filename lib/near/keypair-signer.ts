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
  // Prefer responsive public endpoints. Deduped; order matters for Failover.
  // fastnear 429s are common — keep several alternates so "Exceeded N providers"
  // is rarer during mobile/demo runs.
  const urls = Array.from(
    new Set(
      [
        config.rpcUrl,
        "https://test.rpc.fastnear.com",
        "https://rpc.testnet.near.org",
        "https://testnet.near.lavanet.xyz",
        "https://near-testnet.api.pagoda.co/rpc/v1",
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

/**
 * Run a signed transaction, retrying only on access-key nonce collisions.
 *
 * near-api-js caches the access-key nonce on the Account instance; after a
 * failed or concurrently-confirmed transaction the cached value can be reused
 * and the node rejects it with "must be larger than nonce". Dropping the cache
 * makes the next attempt re-read the nonce from chain.
 */
async function withNonceRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const result = await run()
      // `Account` never advances its cached access-key nonce after a successful
      // transaction, so a second call on the same instance reuses the nonce and
      // is rejected. Drop it so the next call re-reads from chain.
      clearDemoAccountCache()
      return result
    } catch (reason) {
      lastError = reason
      const msg = String(reason)
      const retryable =
        /nonce/i.test(msg) ||
        /429|Rate limit/i.test(msg) ||
        /Exceeded \d+ providers/i.test(msg) ||
        /RetriesExceeded/i.test(msg) ||
        /fetch failed|Connect Timeout|UND_ERR/i.test(msg)
      if (!retryable) throw reason
      // Drop the cached Account AND build a new connection next attempt: the
      // SDK's internal backoff retries with the same instance, whose access-key
      // cache can still hold the nonce that the node just rejected. Also clears
      // a Failover provider that burned through every URL on a 429 burst.
      clearDemoAccountCache()
      await new Promise((resolve) =>
        setTimeout(resolve, 1200 * (attempt + 1) * (/429|Rate limit|Exceeded/i.test(msg) ? 2 : 1)),
      )
    }
  }
  throw lastError
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

  const outcome = (await withNonceRetry(async () => {
    const account = await getDemoAccount(session)
    return account.functionCall({
      contractId: input.receiverId,
      methodName: input.methodName,
      args: input.args ?? {},
      gas: BigInt(input.gas),
      attachedDeposit: BigInt(input.deposit ?? "0"),
    })
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
  const outcome = (await withNonceRetry(async () => {
    const account = await getDemoAccount(session)
    return account.sendMoney(receiverId, BigInt(amount))
  })) as ExecutionOutcomeLike
  return parseFinalExecutionOutcome(outcome)
}
