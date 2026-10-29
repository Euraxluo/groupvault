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
import { getConnectedAccountId } from "@/lib/near/selector"

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
    if (groupId === undefined) {
      setLoading(false)
      return
    }
    if (!session) {
      // Selector still booting — keep the loading copy, do not mark unavailable.
      return
    }
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
    async (
      input: CreateGroupInput,
      deposit: string,
    ): Promise<SignedReceipt & { groupId: number | null }> => {
      setSubmitting(true)
      setError(null)
      try {
        if (!session) throw new Error("Wallet session is not ready")
        const accountId = getConnectedAccountId(session.selector)
        if (!accountId) throw new Error("Connect a wallet before creating a group")

        const config = getNearConfig()
        const client = createGroupVaultClient(
          session.selector,
          new NearRpc(config),
          config.groupVaultContractId,
        )
        const receipt = await client.createGroup(accountId, input, deposit)

        // Prefer the contract return value. If the wallet does not expose it,
        // confirm the new group from bounded chain state instead of assuming 0.
        // A missing ID stays an error: never redirect to a guessed group.
        let groupId: number | null = null
        if (
          typeof receipt.successValue === "number" &&
          Number.isSafeInteger(receipt.successValue)
        ) {
          groupId = receipt.successValue
        } else {
          let readError: unknown
          for (let attempt = 0; attempt < 8 && groupId === null; attempt += 1) {
            try {
              const groups = await client.getGroups(0, 50)
              const owned = groups
                .filter((group) => group.owner === accountId)
                .sort((left, right) => right.id - left.id)
              if (owned[0]) groupId = owned[0].id
              else await new Promise((resolve) => setTimeout(resolve, 1500))
            } catch (reason) {
              readError = reason
              await new Promise((resolve) => setTimeout(resolve, 1500))
            }
          }
          if (groupId === null && readError) {
            throw new Error(
              `群已提交，但链上群号读取失败：${
                readError instanceof Error ? readError.message : String(readError)
              }`,
            )
          }
        }

        return { ...receipt, groupId }
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
      setSubmitting(true)
      setError(null)
      try {
        if (!session) throw new Error("Wallet session is not ready")
        const accountId = getConnectedAccountId(session.selector)
        if (!accountId) throw new Error("Connect a wallet before joining")
        const config = getNearConfig()
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
