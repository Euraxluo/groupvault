"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getConnectedAccountId } from "@/lib/near/selector"

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
  /** Newest proposal id created by this session; null until one is added. */
  lastAddedId: number | null
  addTransfer: (input: {
    receiverId: string
    amount: string
    description: string
  }) => Promise<number>
  approve: (proposal: Proposal) => Promise<void>
  refresh: () => Promise<void>
}

export function useVotes(daoId: string, proposalIds: number[] = []): VoteContext {
  const session = useNearSession()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastAddedId, setLastAddedId] = useState<number | null>(null)

  // Memoized: a fresh client each render would change `refresh` identity and
  // loop the proposal fetch until the public RPC starts returning errors.
  const client = useMemo(
    () =>
      session
        ? createSputnikClient(session.selector, new NearRpc(getNearConfig()))
        : null,
    [session],
  )
  const stakingClient = useMemo(
    () =>
      session
        ? createStakingClient(session.selector, new NearRpc(getNearConfig()))
        : null,
    [session],
  )

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
    const accountId = session
      ? getConnectedAccountId(session.selector)
      : null
    if (!client || !accountId) throw new Error("Connect a council wallet first")
    return accountId
  }

  const addTransfer = useCallback(
    async (input: { receiverId: string; amount: string; description: string }) => {
      const accountId = requireAccount()
      if (!client) throw new Error("DAO client is not ready")
      const policy = await client.getPolicy(daoId)
      const receipt = await client.addProposal(
        accountId,
        daoId,
        {
          description: input.description,
          kind: transferKind({ receiverId: input.receiverId, amount: input.amount }),
        },
        policy.proposal_bond,
      )
      // Sputnik returns the new id as the call result; fall back to the chain
      // counter when the wallet does not surface a success value.
      let id: number
      if (
        typeof receipt.successValue === "number" &&
        Number.isSafeInteger(receipt.successValue)
      ) {
        id = receipt.successValue
      } else {
        id = await client.getNewestProposalId(daoId)
      }
      setLastAddedId(id)
      await refresh()
      return id
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

  return { proposals, loading, error, lastAddedId, addTransfer, approve, refresh }
}
