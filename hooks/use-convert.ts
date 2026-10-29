"use client"

import { useCallback, useEffect, useState } from "react"
import { getConnectedAccountId } from "@/lib/near/selector"
import { subscribeDemoKeypair } from "@/lib/near/keypair-session"

import { getNearConfig } from "@/lib/near/config"
import { CONVERT_DEPOSIT } from "@/lib/near/deposits"
import { createGroupVaultClient, type GroupView } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"
import { useNearSession } from "@/hooks/use-near-session"

export interface ConvertState {
  group: GroupView | null
  canConvert: boolean
  reason: string | null
  pending: boolean
  submitting: boolean
  error: string | null
  submit: (daoName: string, purpose: string) => Promise<string>
  refresh: () => Promise<void>
}

export interface ConvertOptions {
  /** Delay between chain reads while waiting for the factory callback. */
  pollIntervalMs?: number
  /** Terminal deadline; submit throws instead of returning an unconfirmed ID. */
  deadlineMs?: number
}

export function useConvert(groupId: number, options: ConvertOptions = {}): ConvertState {
  const pollIntervalMs = options.pollIntervalMs ?? 3000
  const deadlineMs = options.deadlineMs ?? 180_000
  const session = useNearSession()
  const [group, setGroup] = useState<GroupView | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const sync = () => setAccountId(getConnectedAccountId(session.selector))
    sync()
    const unsubDemo = subscribeDemoKeypair(sync)
    const sub = session.selector.store.observable.subscribe(sync)
    return () => {
      unsubDemo()
      sub.unsubscribe()
    }
  }, [session])

  const refresh = useCallback(async () => {
    if (!session) return
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("GroupVault contract is not configured yet.")
      return
    }
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const client = createGroupVaultClient(
          session.selector,
          new NearRpc(config),
          config.groupVaultContractId,
        )
        setGroup(await client.getGroup(groupId))
        setError(null)
        return
      } catch (reason) {
        lastError = reason
        const msg = String(reason)
        if (!/429|Rate limit|Exceeded|fetch failed|timeout/i.test(msg)) break
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
      }
    }
    setError(lastError instanceof Error ? lastError.message : String(lastError))
  }, [session, groupId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submit = useCallback(
    async (daoName: string, purpose: string): Promise<string> => {
      if (!session || !accountId || !group) {
        throw new Error("Wallet and group are required")
      }
      const config = getNearConfig()
      const client = createGroupVaultClient(
        session.selector,
        new NearRpc(config),
        config.groupVaultContractId,
      )
      setSubmitting(true)
      setError(null)
      try {
        await client.convertToDao(
          accountId,
          groupId,
          daoName,
          purpose,
          CONVERT_DEPOSIT,
        )
        // The factory callback lands after the owner transaction executes, so
        // the immediate read still shows convert_pending. Poll until the chain
        // returns a dao_id; every non-terminal state is an error.
        const deadline = Date.now() + deadlineMs
        let sawPending = false
        for (;;) {
          const next = await client.getGroup(groupId)
          setGroup(next)
          if (next.dao_id) return next.dao_id
          if (next.convert_pending) sawPending = true
          else if (sawPending) {
            throw new Error("升级未完成：链上回调没有写入 DAO")
          }
          const remaining = deadline - Date.now()
          if (remaining <= 0) {
            throw new Error("升级确认超时：尚未读到链上 DAO ID")
          }
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(pollIntervalMs, remaining)),
          )
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        throw reason
      } finally {
        setSubmitting(false)
      }
    },
    [session, accountId, group, groupId, pollIntervalMs, deadlineMs],
  )

  const reason = !accountId
    ? "Connect the owner wallet"
    : !group
      ? "Group is not loaded"
      : accountId !== group.owner
        ? "Only the group owner can convert"
        : group.dao_id
          ? "This group is already a DAO"
          : group.convert_pending
            ? "A Convert is already pending"
            : null

  return {
    group,
    canConvert: reason === null,
    reason,
    pending: Boolean(group?.convert_pending),
    submitting,
    error,
    submit,
    refresh,
  }
}
