"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Inbox, Loader2 } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useNearSession } from "@/hooks/use-near-session"
import { DEMO_STORY } from "@/lib/demo-story"
import { getNearConfig } from "@/lib/near/config"
import { NearRpc } from "@/lib/near/rpc"
import { createSputnikClient, type Proposal } from "@/lib/near/sputnik"

const LOOKBACK = 8

export default function InboxPage() {
  const session = useNearSession()
  const [daoId, setDaoId] = useState<string>(DEMO_STORY.daoId)
  const [pending, setPending] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMemo(
    () =>
      session
        ? createSputnikClient(session.selector, new NearRpc(getNearConfig()))
        : null,
    [session],
  )

  useEffect(() => {
    if (!client || !daoId.includes(".")) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const newest = await client.getNewestProposalId(daoId)
        if (newest < 0) {
          if (!cancelled) {
            setPending([])
            setError(null)
          }
          return
        }
        const start = Math.max(0, newest - LOOKBACK + 1)
        const ids = Array.from({ length: newest - start + 1 }, (_, i) => start + i)
        const proposals = await Promise.all(
          ids.map((id) => client.getProposal(daoId, id)),
        )
        if (!cancelled) {
          setPending(proposals.filter((p) => p.status === "InProgress"))
          setError(null)
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
          setPending([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, daoId])

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Inbox className="h-6 w-6" /> Inbox
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pending (InProgress) proposals for a DAO. Defaults to the demo DAO.
            Connect a wallet so the RPC client can sign later votes.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={daoId}
            onChange={(event) => setDaoId(event.target.value.trim())}
            placeholder="dao.sputnikv2.testnet"
          />
          <Button
            variant="outline"
            onClick={() => setDaoId(DEMO_STORY.daoId)}
            disabled={daoId === DEMO_STORY.daoId}
          >
            Demo
          </Button>
        </div>

        {!session ? (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Connect a wallet to load proposals. Views still need a selector
            session in this app.
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Scanning recent proposals…
          </p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {!loading && !error && pending.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>No InProgress proposals in the recent window.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dao/${daoId}/treasury`}>Create a Transfer</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-2">
          {pending.map((proposal) => (
            <Card key={proposal.id} className="shadow-none">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">#{proposal.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.description}
                    </p>
                  </div>
                  <Badge variant="outline">{proposal.status}</Badge>
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/dao/${daoId}/proposals/${proposal.id}`}>
                    Open / vote <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
