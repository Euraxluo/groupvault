"use client"

import { useCallback, useEffect, useState } from "react"

import { getNearConfig } from "@/lib/near/config"
import { NearRpc } from "@/lib/near/rpc"
import {
  createSputnikClient,
  type Policy,
  type SputnikClient,
} from "@/lib/near/sputnik"
import { createStakingClient, type StakingClient } from "@/lib/near/staking"
import { useNearSession } from "@/hooks/use-near-session"

export interface DaoContext {
  accountId: string | null
  policy: Policy | null
  stakingContract: string | null
  delegation: string
  sputnik: SputnikClient | null
  staking: StakingClient | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDao(daoId: string): DaoContext {
  const session = useNearSession()
  const [accountId, setAccountId] = useState<string | null>(null)
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [stakingContract, setStakingContract] = useState<string | null>(null)
  const [delegation, setDelegation] = useState("0")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setAccountId(
      session.selector.store
        .getState()
        .accounts.find((account) => account.active)?.accountId ?? null,
    )
  }, [session])

  const sputnik = session
    ? createSputnikClient(session.selector, new NearRpc(getNearConfig()))
    : null
  const staking = session
    ? createStakingClient(session.selector, new NearRpc(getNearConfig()))
    : null

  const refresh = useCallback(async () => {
    if (!sputnik) return
    try {
      const nextPolicy = await sputnik.getPolicy(daoId)
      const nextStaking = await sputnik.getStakingContract(daoId)
      setPolicy(nextPolicy)
      setStakingContract(nextStaking)
      if (nextStaking && accountId) {
        setDelegation(await staking!.getDelegation(nextStaking, accountId))
      } else {
        setDelegation("0")
      }
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [sputnik, staking, daoId, accountId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    accountId,
    policy,
    stakingContract,
    delegation,
    sputnik,
    staking,
    loading,
    error,
    refresh,
  }
}
