"use client"

import { useCallback, useEffect, useState } from "react"

import { getNearConfig } from "@/lib/near/config"
import {
  createGroupVaultClient,
  type CreateGroupInput,
  type GroupView,
} from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"
import { joinGroup } from "@/lib/near/ft"
import type { SignedReceipt } from "@/lib/near/actions"
import { useNearSession } from "@/hooks/use-near-session"

export interface GroupContext {
  ready: boolean
  group: GroupView | null
  members: string[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useGroupVault(groupId?: number): GroupContext {
  const session = useNearSession()
  const [group, setGroup] = useState<GroupView | null>(null)
  const [members, setMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!session || groupId === undefined) return
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("GroupVault contract is not configured yet.")
      setLoading(false)
      return
    }
    const client = createGroupVaultClient(
      session.selector,
      new NearRpc(config),
      config.groupVaultContractId,
    )
    try {
      const [nextGroup, nextMembers] = await Promise.all([
        client.getGroup(groupId),
        client.getMembers(groupId),
      ])
      setGroup(nextGroup)
      setMembers(nextMembers)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [session, groupId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    ready: Boolean(session),
    group,
    members,
    loading,
    error,
    refresh,
  }
}

export function useCreateGroup() {
  const session = useNearSession()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (input: CreateGroupInput, deposit: string): Promise<SignedReceipt> => {
      if (!session) throw new Error("Wallet session is not ready")
      const accountId = session.selector.store
        .getState()
        .accounts.find((account) => account.active)?.accountId
      if (!accountId) throw new Error("Connect a wallet before creating a group")

      const config = getNearConfig()
      const client = createGroupVaultClient(
        session.selector,
        new NearRpc(config),
        config.groupVaultContractId,
      )
      setSubmitting(true)
      setError(null)
      try {
        return await client.createGroup(accountId, input, deposit)
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason)
        setError(message)
        throw reason
      } finally {
        setSubmitting(false)
      }
    },
    [session],
  )

  return { create, submitting, error }
}

export function useJoinGroup(groupId: number) {
  const session = useNearSession()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = useCallback(
    async (amount: string) => {
      if (!session) throw new Error("Wallet session is not ready")
      const accountId = session.selector.store
        .getState()
        .accounts.find((account) => account.active)?.accountId
      if (!accountId) throw new Error("Connect a wallet before joining")
      const config = getNearConfig()
      setSubmitting(true)
      setError(null)
      try {
        return await joinGroup(session.selector, {
          signerId: accountId,
          groupId,
          joinFt: config.joinFtContractId,
          amount,
          contractId: config.groupVaultContractId,
        })
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason)
        setError(message)
        throw reason
      } finally {
        setSubmitting(false)
      }
    },
    [session, groupId],
  )

  return { join, submitting, error }
}
