/**
 * scripts/gas-reserve.mjs
 *
 * Gas reserve maintenance script for GroupVault testnet demo onboarding.
 *
 * Intended cron line (installed by hub, do not install via crontab/launchd):
 * 0 *\/2 * * * cd /Users/echo/project/groupvault && NODE_USE_ENV_PROXY=1 GAS_RESERVE_TARGET_N=40 /opt/homebrew/opt/node@22/bin/node scripts/gas-reserve.mjs refill >> artifacts/gas-reserve-cron.log 2>&1
 *
 * Env quirk baked in:
 * The helper host (https://helper.testnet.near.org) may need the system proxy.
 * The hub runs it with NODE_USE_ENV_PROXY=1; surface fetch errors honestly either way.
 */

import { randomBytes } from "node:crypto"
import { appendFile, chmod, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { connect, keyStores, KeyPair, utils } from "near-api-js"

export const DEFAULT_RPC_URL = "https://testnet-rpc.intea.rs"
export const DEFAULT_HELPER_URL = "https://helper.testnet.near.org/account"
export const DEFAULT_RESERVE_ACCOUNT = "gv-gas-reserve.testnet"
export const DEFAULT_TARGET_N = 40
export const DEFAULT_LOG_PATH = path.join(
  process.cwd(),
  "artifacts",
  "gas-reserve.log",
)
export const ACCOUNT_POLL_TIMEOUT_MS = 60_000
export const ACCOUNT_POLL_INTERVAL_MS = 2_000
export const RPC_REQUEST_TIMEOUT_MS = 10_000

export function yoctoToNear(yocto) {
  const yoctoBig = typeof yocto === "bigint" ? yocto : BigInt(yocto)
  const whole = yoctoBig / 10n ** 24n
  const fraction = yoctoBig % 10n ** 24n
  const micro = fraction / 10n ** 18n
  return Number(whole) + Number(micro) / 1e6
}

export function nearAmountToYocto(amountN) {
  const parsed = utils.format.parseNearAmount(String(amountN))
  if (!parsed) {
    throw new Error(`Invalid NEAR amount: ${amountN}`)
  }
  return BigInt(parsed)
}

export async function appendReserveLog(entry, logPath = DEFAULT_LOG_PATH) {
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    }) + "\n"
  const dir = path.dirname(logPath)
  await mkdir(dir, { recursive: true })
  await appendFile(logPath, line, "utf8")
}

export async function getAccountBalanceYocto(fetchImpl, rpcUrl, accountId) {
  try {
    const res = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "gas-reserve-query",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
      signal: AbortSignal.timeout(RPC_REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const payload = await res.json()
    if (typeof payload.result?.amount === "string") {
      return BigInt(payload.result.amount)
    }
    return null
  } catch {
    return null
  }
}

export async function defaultSweepTransfer({
  senderAccountId,
  receiverAccountId,
  amountYocto,
  keyPair,
  rpcUrl,
}) {
  const keyStore = new keyStores.InMemoryKeyStore()
  await keyStore.setKey("testnet", senderAccountId, keyPair)
  const near = await connect({
    networkId: "testnet",
    nodeUrl: rpcUrl,
    keyStore,
  })
  const sender = await near.account(senderAccountId)
  await sender.sendMoney(receiverAccountId, amountYocto)
}

export async function runStatus(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const rpcUrl =
    options.rpcUrl ??
    process.env.NEAR_RPC_URL?.trim() ??
    DEFAULT_RPC_URL
  const reserveAccount =
    options.reserveAccount ??
    process.env.GAS_RESERVE_ACCOUNT?.trim() ??
    DEFAULT_RESERVE_ACCOUNT
  const target =
    options.targetN ??
    Number(process.env.GAS_RESERVE_TARGET_N?.trim() || DEFAULT_TARGET_N)
  const logPath = options.logPath ?? DEFAULT_LOG_PATH
  const logAppend = options.logAppend ?? ((e) => appendReserveLog(e, logPath))

  const balanceYocto = await getAccountBalanceYocto(
    fetchImpl,
    rpcUrl,
    reserveAccount,
  )
  if (balanceYocto === null) {
    const err = `Failed to query balance for ${reserveAccount} from ${rpcUrl}`
    await logAppend({
      action: "status_error",
      account: reserveAccount,
      error: err,
      ok: false,
    })
    console.error(err)
    if (options.throwOnError) {
      throw new Error(err)
    }
    process.exitCode = 1
    return { ok: false, error: err }
  }

  const balanceN = yoctoToNear(balanceYocto)
  const deficit = Math.max(0, target - balanceN)

  console.log(`balanceN: ${balanceN}`)
  console.log(`target: ${target}`)
  console.log(`deficit: ${deficit}`)

  await logAppend({
    action: "status",
    account: reserveAccount,
    balanceN,
    target,
    deficit,
    ok: true,
  })

  return { ok: true, balanceN, target, deficit }
}

export async function runRefill(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? ACCOUNT_POLL_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? ACCOUNT_POLL_INTERVAL_MS
  const rpcUrl =
    options.rpcUrl ??
    process.env.NEAR_RPC_URL?.trim() ??
    DEFAULT_RPC_URL
  const helperUrl =
    options.helperUrl ??
    process.env.HELPER_ACCOUNT_URL?.trim() ??
    DEFAULT_HELPER_URL
  const reserveAccount =
    options.reserveAccount ??
    process.env.GAS_RESERVE_ACCOUNT?.trim() ??
    DEFAULT_RESERVE_ACCOUNT
  const target =
    options.targetN ??
    Number(process.env.GAS_RESERVE_TARGET_N?.trim() || DEFAULT_TARGET_N)
  const credentialsDir =
    options.credentialsDir ??
    process.env.GV_DEMO_CREDENTIALS_DIR?.trim() ??
    path.join(os.homedir(), ".near-credentials", "testnet")
  const logPath = options.logPath ?? DEFAULT_LOG_PATH
  const logAppend = options.logAppend ?? ((e) => appendReserveLog(e, logPath))
  const sweepTransfer = options.sweepTransfer ?? defaultSweepTransfer

  // Step 1: Check reserve balance
  const initialBalanceYocto = await getAccountBalanceYocto(
    fetchImpl,
    rpcUrl,
    reserveAccount,
  )
  const currentBalanceN =
    initialBalanceYocto !== null ? yoctoToNear(initialBalanceYocto) : 0

  if (currentBalanceN >= target) {
    console.log(
      `Reserve balance ${currentBalanceN}N is >= target ${target}N; no-op.`,
    )
    await logAppend({
      action: "refill_noop",
      account: reserveAccount,
      balanceN: currentBalanceN,
      target,
      deficit: 0,
      ok: true,
    })
    return { ok: true, noop: true, balanceN: currentBalanceN }
  }

  console.log(
    `Reserve balance ${currentBalanceN}N < target ${target}N; beginning refill.`,
  )

  let balanceN = currentBalanceN
  let claims = 0
  const maxClaims = options.maxClaims ?? 5

  while (claims < maxClaims && balanceN < target) {
    claims += 1
    const topupAccountId = `gv-gas-topup-${randomBytes(6).toString("hex")}.testnet`
    const keyPair = KeyPair.fromRandom("ed25519")
    const publicKey = keyPair.getPublicKey().toString()
    const privateKey = keyPair.toString()

    // Save creds 0600
    try {
      await mkdir(credentialsDir, { recursive: true, mode: 0o700 })
      const credPath = path.join(credentialsDir, `${topupAccountId}.json`)
      await writeFile(
        credPath,
        `${JSON.stringify(
          {
            account_id: topupAccountId,
            public_key: publicKey,
            private_key: privateKey,
          },
          null,
          2,
        )}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      )
      await chmod(credPath, 0o600)
    } catch (saveErr) {
      const errMsg = `Failed to save topup credentials: ${saveErr.message}`
      await logAppend({
        action: "claim_error",
        accountId: topupAccountId,
        error: errMsg,
        ok: false,
      })
      console.error(errMsg)
      if (options.throwOnError) throw new Error(errMsg)
      process.exitCode = 1
      return { ok: false, error: errMsg }
    }

    // Call helper faucet
    let faucetRes
    try {
      faucetRes = await fetchImpl(helperUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newAccountId: topupAccountId,
          newAccountPublicKey: publicKey,
        }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch (fetchErr) {
      const errMsg = `Faucet claim network failure for ${topupAccountId}: ${fetchErr.message}`
      await logAppend({
        action: "claim_error",
        accountId: topupAccountId,
        error: errMsg,
        ok: false,
      })
      console.error(errMsg)
      if (options.throwOnError) throw new Error(errMsg)
      process.exitCode = 1
      return { ok: false, error: errMsg }
    }

    if (!faucetRes.ok) {
      const errMsg = `Faucet responded with HTTP ${faucetRes.status} for ${topupAccountId}`
      await logAppend({
        action: "claim_error",
        accountId: topupAccountId,
        error: errMsg,
        ok: false,
      })
      console.error(errMsg)
      if (options.throwOnError) throw new Error(errMsg)
      process.exitCode = 1
      return { ok: false, error: errMsg }
    }

    // Poll view_account until exists, <=60s
    const deadline = now() + timeoutMs
    let confirmed = false
    do {
      const bal = await getAccountBalanceYocto(fetchImpl, rpcUrl, topupAccountId)
      if (bal !== null && bal > 0n) {
        confirmed = true
        break
      }
      const remaining = deadline - now()
      if (remaining <= 0) break
      await sleep(Math.min(intervalMs, remaining))
    } while (now() <= deadline)

    if (!confirmed) {
      const errMsg = `Topup account ${topupAccountId} did not appear on RPC within ${timeoutMs / 1000}s`
      await logAppend({
        action: "poll_timeout",
        accountId: topupAccountId,
        error: errMsg,
        ok: false,
      })
      console.error(errMsg)
      if (options.throwOnError) throw new Error(errMsg)
      process.exitCode = 1
      return { ok: false, error: errMsg }
    }

    await logAppend({
      action: "claim",
      accountId: topupAccountId,
      amountN: 10,
      ok: true,
    })

    // Transfer (10 - 0.1)N = 9.9N to reserve account
    const sweepAmountYocto = nearAmountToYocto("9.9")
    try {
      await sweepTransfer({
        senderAccountId: topupAccountId,
        receiverAccountId: reserveAccount,
        amountYocto: sweepAmountYocto,
        keyPair,
        rpcUrl,
      })
    } catch (sweepErr) {
      const errMsg = `Failed to sweep funds from ${topupAccountId} to ${reserveAccount}: ${sweepErr.message}`
      await logAppend({
        action: "sweep_error",
        from: topupAccountId,
        to: reserveAccount,
        amountN: 9.9,
        error: errMsg,
        ok: false,
      })
      console.error(errMsg)
      if (options.throwOnError) throw new Error(errMsg)
      process.exitCode = 1
      return { ok: false, error: errMsg }
    }

    await logAppend({
      action: "sweep",
      from: topupAccountId,
      to: reserveAccount,
      amountN: 9.9,
      ok: true,
    })

    // Update balance
    const updatedBalanceYocto = await getAccountBalanceYocto(
      fetchImpl,
      rpcUrl,
      reserveAccount,
    )
    balanceN =
      updatedBalanceYocto !== null
        ? yoctoToNear(updatedBalanceYocto)
        : balanceN + 9.9
  }

  console.log(`Refill finished. Reserve balance: ${balanceN}N, target: ${target}N.`)
  return { ok: true, balanceN, target, claims }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const subcommand = process.argv[2]
  if (subcommand === "status") {
    runStatus({ throwOnError: false })
      .then((res) => {
        if (!res?.ok) process.exit(1)
      })
      .catch((err) => {
        console.error(err)
        process.exit(1)
      })
  } else if (subcommand === "refill") {
    runRefill({ throwOnError: false })
      .then((res) => {
        if (!res?.ok) process.exit(1)
      })
      .catch((err) => {
        console.error(err)
        process.exit(1)
      })
  } else {
    console.error("Usage: node scripts/gas-reserve.mjs [status|refill]")
    process.exit(1)
  }
}
