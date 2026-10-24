"use client"

import { use } from "react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { StakingSetup } from "@/components/staking-setup"

export default function StakingSetupPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Staking setup</h1>
        <p className="mb-4 text-xs text-muted-foreground">
          Two governance proposals, then three staking transactions. Paid join is
          never voting weight.
        </p>
        <StakingSetup daoId={daoId} />
      </div>
    </main>
  )
}
