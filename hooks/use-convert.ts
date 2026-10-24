"use client"

import { useCallback, useEffect, useState } from "react"

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
    setAccountId(
      session.selector.store
        .getState()
        .accounts.find((account) => account.active)?.accountId ?? null,
    )
  }, [session])

  const refresh = useCallback(async () => {
    if (!session) return
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("GroupVault contract is not configured yet.")
      return
    }
    try {
      const client = createGroupVaultClient(
        session.selector,
        new NearRpc(config),
        config.groupVaultContractId,
      )
      setGroup(await client.getGroup(groupId))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
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
        // Wait for final state; never invent dao_id from the submitted hash.
        await refresh()
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
