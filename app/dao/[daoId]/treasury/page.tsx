"use client"

import { use } from "react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { GroupTreasury } from "@/components/group-treasury"

export default function TreasuryPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">DAO treasury</h1>
        <GroupTreasury daoId={daoId} />
      </div>
    </main>
  )
}
