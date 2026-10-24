import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { connect, keyStores, KeyPair, providers } from "near-api-js"

/**
 * Deploy/testnet helper that signs with credentials from ~/.near-credentials.
 * near-cli 4 relies on `rpc.testnet.near.org`, which is frequently unreachable
 * on constrained hosts; this uses the same failover provider as the demo signer.
 * Credentials are read at runtime only and never written to the repo.
 */
export const STAKING_SUBACCOUNT_PREFIX = "sputnikstaking"

export function stakingAccountId(deployer: string): string {
  // A true subaccount of the deployer: `-staking.testnet` is a separate
  // top-level account and cannot be created by the deployer.
  return `${STAKING_SUBACCOUNT_PREFIX}.${deployer}`
}

function rpcUrls(): string[] {
  const configured = process.env.NEAR_RPC_URL?.trim()
  return Array.from(
    new Set(
      [configured, "https://test.rpc.fastnear.com"].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  )
}

async function signerAccount(accountId: string) {
  const path = join(
    homedir(),
    ".near-credentials",
    "testnet",
    `${accountId}.json`,
  )
  const credentials = JSON.parse(readFileSync(path, "utf8")) as {
    private_key: string
  }
  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey(
    "testnet",
    accountId,
    KeyPair.fromString(
      credentials.private_key as Parameters<typeof KeyPair.fromString>[0],
    ),
  )
  const urls = rpcUrls()
  const provider = new providers.FailoverRpcProvider(
    urls.map((url) => new providers.JsonRpcProvider({ url })),
  )
  const near = await connect({
    networkId: "testnet",
    nodeUrl: urls[0]!,
    provider,
    keyStore,
  })
  return near.account(accountId)
}

function txHash(outcome: unknown): string {
  return (
    (outcome as { transaction_outcome?: { id?: string } }).transaction_outcome
      ?.id ?? ""
  )
}

export async function deploySubaccount(input: {
  deployer: string
  accountId: string
  wasmPath: string
  initFunction: string
  initArgs: Record<string, unknown>
}): Promise<string> {
  const account = await signerAccount(input.deployer)
  const credentialDir = join(homedir(), ".near-credentials", "testnet")
  const credentialPath = join(credentialDir, `${input.accountId}.json`)
  let keyPair: KeyPair
  let createdHash = ""
  if (existsSync(credentialPath)) {
    // Resume an interrupted deploy instead of creating the account again.
    const saved = JSON.parse(readFileSync(credentialPath, "utf8")) as {
      private_key: string
    }
    keyPair = KeyPair.fromString(
      saved.private_key as Parameters<typeof KeyPair.fromString>[0],
    )
  } else {
    keyPair = KeyPair.fromRandom("ed25519")
    const publicKey = keyPair.getPublicKey().toString()
    // 5 NEAR covers storage for the ~200 KB staking wasm plus the init call.
    const created = await account.createAccount(
      input.accountId,
      publicKey,
      5_000_000_000_000_000_000_000_000n,
    )
    createdHash = txHash(created)
    // Persist before deploy so a failed deploy can be retried with same key.
    mkdirSync(credentialDir, { recursive: true })
    writeFileSync(
      credentialPath,
      `${JSON.stringify(
        {
          account_id: input.accountId,
          public_key: publicKey,
          private_key: keyPair.toString(),
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    )
  }

  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", input.accountId, keyPair)
  const urls = rpcUrls()
  const near = await connect({
    networkId: "testnet",
    nodeUrl: urls[0]!,
    provider: new providers.FailoverRpcProvider(
      urls.map((url) => new providers.JsonRpcProvider({ url })),
    ),
    keyStore,
  })
  const child = await near.account(input.accountId)
  const wasm = readFileSync(input.wasmPath)

  // The SDK caches the access-key nonce; after any failure the cache is stale
  // and repeats the same nonce. Retry with a reconnected account each attempt.
  const attempt = async <T>(run: (account: typeof child) => Promise<T>): Promise<T> => {
    let lastError: unknown
    for (let index = 0; index < 5; index += 1) {
      try {
        const fresh = await connect({
          networkId: "testnet",
          nodeUrl: urls[0]!,
          provider: new providers.FailoverRpcProvider(
            urls.map((url) => new providers.JsonRpcProvider({ url })),
          ),
          keyStore,
        })
        return await run(await fresh.account(input.accountId))
      } catch (reason) {
        lastError = reason
        if (!/InvalidNonce|nonce/i.test(String(reason))) throw reason
        await new Promise((resolve) => setTimeout(resolve, 2500 * (index + 1)))
      }
    }
    throw lastError
  }

  const deployed = await attempt((account) => account.deployContract(wasm))
  const initialized = await attempt((account) =>
    account.functionCall({
      contractId: input.accountId,
      methodName: input.initFunction,
      args: input.initArgs,
      gas: 100_000_000_000_000n,
      attachedDeposit: 0n,
    }),
  )

  const hashes = [createdHash || "resumed", txHash(deployed), txHash(initialized)]
  if (hashes.some((hash) => hash === "")) {
    throw new Error("Staking deploy did not return all transaction hashes")
  }
  return hashes.join(",")
}
