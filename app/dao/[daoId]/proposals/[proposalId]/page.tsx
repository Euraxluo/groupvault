"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useVotes } from "@/hooks/use-votes"
import { useNearWallet } from "@/hooks/use-near-wallet"

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ daoId: string; proposalId: string }>
}) {
  const { daoId, proposalId: raw } = use(params)
  const proposalId = Number(raw)
  const valid = Number.isSafeInteger(proposalId) && proposalId >= 0
  const votes = useVotes(daoId, valid ? [proposalId] : [])
  const wallet = useNearWallet()
  const proposal = votes.proposals[0]

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dao/${daoId}/proposals?ids=${valid ? proposalId : ""}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Proposals
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Proposal #{valid ? proposalId : "?"}
          </h1>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {daoId}
          </p>
        </div>

        {!valid ? (
          <p className="text-sm text-destructive">Invalid proposal id.</p>
        ) : votes.loading && !proposal ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading proposal…
          </p>
        ) : !proposal ? (
          <Card className="shadow-none">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium">Proposal not found</p>
              <p className="text-xs text-muted-foreground">
                {votes.error ??
                  "RPC returned no proposal. Check the id or wait for finality."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{proposal.description}</CardTitle>
                <Badge variant="outline">{proposal.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                Proposer{" "}
                <span className="break-all font-mono">{proposal.proposer}</span>
              </p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px]">
                {JSON.stringify(proposal.kind, null, 2)}
              </pre>
              {!wallet.accountId ? (
                <p className="text-xs text-muted-foreground">
                  Connect a wallet to vote. TokenWeight requires a non-zero
                  delegation.
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={!wallet.accountId || proposal.status !== "InProgress"}
                onClick={() => void votes.approve(proposal)}
              >
                Approve exact kind
              </Button>
              {proposal.status !== "InProgress" ? (
                <p className="text-[11px] text-muted-foreground">
                  Status is {proposal.status}. Approving only applies while
                  InProgress; threshold approval schedules execution.
                </p>
              ) : null}
              {votes.error ? (
                <p className="text-xs text-destructive">{votes.error}</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
