"use client"

import { useCallback, useEffect, useState } from "react"

import { getNearConfig } from "@/lib/near/config"
import { NearRpc } from "@/lib/near/rpc"
import { createSputnikClient, transferKind, type Proposal } from "@/lib/near/sputnik"
import { createStakingClient } from "@/lib/near/staking"
import { applyApprovalWithWeightGate } from "@/lib/approval-gate"
import { useNearSession } from "@/hooks/use-near-session"

export interface VoteContext {
  proposals: Proposal[]
  loading: boolean
  error: string | null
  addTransfer: (input: {
    receiverId: string
    amount: string
    description: string
  }) => Promise<void>
  approve: (proposal: Proposal) => Promise<void>
  refresh: () => Promise<void>
}

export function useVotes(daoId: string, proposalIds: number[] = []): VoteContext {
  const session = useNearSession()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const client = session
    ? createSputnikClient(session.selector, new NearRpc(getNearConfig()))
    : null
  const stakingClient = session
    ? createStakingClient(session.selector, new NearRpc(getNearConfig()))
    : null

  const refresh = useCallback(async () => {
    if (!client) return
    try {
      const next = await Promise.all(
        proposalIds.map((id) => client.getProposal(daoId, id)),
      )
      setProposals(next)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [client, daoId, proposalIds.join(",")])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requireAccount = (): string => {
    const accountId = session?.selector.store
      .getState()
      .accounts.find((account) => account.active)?.accountId
    if (!client || !accountId) throw new Error("Connect a council wallet first")
    return accountId
  }

  const addTransfer = useCallback(
    async (input: { receiverId: string; amount: string; description: string }) => {
      const accountId = requireAccount()
      if (!client) return
      const policy = await client.getPolicy(daoId)
      await client.addProposal(
        accountId,
        daoId,
        {
          description: input.description,
          kind: transferKind({ receiverId: input.receiverId, amount: input.amount }),
        },
        policy.proposal_bond,
      )
      await refresh()
    },
    [client, daoId, refresh, session],
  )

  const approve = useCallback(
    async (proposal: Proposal) => {
      const accountId = requireAccount()
      if (!client || !stakingClient) return

      await applyApprovalWithWeightGate({
        daoId,
        proposal,
        accountId,
        client,
        staking: stakingClient,
      })
      await refresh()
    },
    [client, stakingClient, daoId, refresh, session],
  )

  return { proposals, loading, error, addTransfer, approve, refresh }
}
