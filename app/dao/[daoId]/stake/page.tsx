"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { StakePanel } from "@/components/stake-panel"
import { Button } from "@/components/ui/button"

export default function StakePage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dao/${daoId}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> DAO hub
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stake</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Storage deposit, empty-msg FT transfer, then delegate. Weight comes
            only from this path.
          </p>
        </div>
        <StakePanel daoId={daoId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dao/${daoId}/staking/setup`}>Staking setup</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dao/${daoId}/treasury`}>Treasury</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
