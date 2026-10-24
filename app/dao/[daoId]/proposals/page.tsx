"use client"

import { use, useState } from "react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { ProposalList } from "@/components/group-treasury"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVotes } from "@/hooks/use-votes"

export default function ProposalsPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)
  const [ids, setIds] = useState<number[]>([])
  const [candidate, setCandidate] = useState("")
  const votes = useVotes(daoId, ids)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
        <p className="text-xs text-muted-foreground">
          Approval sends act_proposal(VoteApprove) with the exact proposal kind.
          Approving at threshold schedules execution; there is no extra execute
          signature.
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="proposal ID"
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          />
          <Button
            disabled={!/^\d+$/.test(candidate)}
            onClick={() => {
              const id = Number(candidate)
              if (!ids.includes(id)) setIds([...ids, id])
              setCandidate("")
            }}
          >
            Load
          </Button>
        </div>
        {votes.error ? <p className="text-xs text-destructive">{votes.error}</p> : null}
        <ProposalList proposals={votes.proposals} onApprove={votes.approve} />
      </div>
    </main>
  )
}
