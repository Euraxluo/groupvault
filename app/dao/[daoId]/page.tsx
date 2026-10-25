"use client"

import { use } from "react"
import {
  ArrowRight,
  Coins,
  Inbox,
  KeyRound,
  ShieldCheck,
  Vote,
} from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDao } from "@/hooks/use-dao"
import { DEMO_STORY } from "@/lib/demo-story"

export default function DaoOverviewPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)
  const dao = useDao(daoId)
  const proposalQuery = DEMO_STORY.proposalIds.join(",")

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DAO</h1>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {daoId}
          </p>
        </div>

        {dao.error ? (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">RPC / load failed</p>
            <p className="break-words text-[11px] text-destructive/90">{dao.error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 min-h-10 w-full rounded-xl"
              onClick={() => void dao.refresh()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-4">
              <Vote className="h-4 w-4 text-primary" />
              <p className="mt-3 text-[10px] uppercase text-muted-foreground">
                Vote policy
              </p>
              <p className="text-sm font-bold">
                {dao.error ? "—" : (dao.policy?.default_vote_policy.weight_kind ?? (dao.loading ? "Loading…" : "—"))}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4">
              <Coins className="h-4 w-4 text-emerald-600" />
              <p className="mt-3 text-[10px] uppercase text-muted-foreground">
                Your delegation
              </p>
              <p className="truncate text-sm font-bold">{dao.delegation}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4" /> Staking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-xs">
            <p className="text-muted-foreground">
              {dao.error
                ? "Could not load staking status (RPC). Retry above — do not treat this as unset."
                : dao.loading
                  ? "Loading staking contract…"
                  : dao.stakingContract
                    ? "Staking is set. Voting weight comes only from the join FT."
                    : "Staking is not set yet. The council must approve SetStakingContract first."}
            </p>
            <p className="break-all font-mono">
              {dao.error
                ? "status unknown"
                : dao.loading
                  ? "…"
                  : (dao.stakingContract ?? "not set")}
            </p>
            <Badge
              variant={
                dao.error || dao.loading
                  ? "outline"
                  : dao.stakingContract
                    ? "default"
                    : "secondary"
              }
            >
              {dao.error
                ? "Load error"
                : dao.loading
                  ? "Loading"
                  : dao.stakingContract
                    ? "Ready"
                    : "Setup required"}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Button asChild>
            <Link href={`/dao/${daoId}/staking/setup`}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Staking setup
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/stake`}>
              <Coins className="mr-2 h-4 w-4" /> Stake / delegate
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/treasury`}>
              Treasury and Transfer <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/proposals?ids=${proposalQuery}`}>
              <Vote className="mr-2 h-4 w-4" /> Proposals
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/inbox">
              <Inbox className="mr-2 h-4 w-4" /> Inbox
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
