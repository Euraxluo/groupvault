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
  submit: (daoName: string, purpose: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useConvert(groupId: number): ConvertState {
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
    async (daoName: string, purpose: string) => {
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
        // the immediate read still shows convert_pending. Poll until the final
        // state arrives; never invent dao_id from the submitted hash.
        const deadline = Date.now() + 180_000
        let sawPending = false
        while (Date.now() < deadline) {
          const next = await client.getGroup(groupId)
          setGroup(next)
          if (next.dao_id) break
          if (next.convert_pending) {
            sawPending = true
          } else if (sawPending) {
            // The callback cleared pending without a dao_id: factory failure.
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        throw reason
      } finally {
        setSubmitting(false)
      }
    },
    [session, accountId, group, groupId, refresh],
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
