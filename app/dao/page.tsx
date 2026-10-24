"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DaoEntryPage() {
  const [daoId, setDaoId] = useState("")

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">DAO</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Open a converted DAO by account ID.
        </p>
        <Input
          className="mt-4"
          placeholder="groupvault-0.sputnikv2.testnet"
          value={daoId}
          onChange={(event) => setDaoId(event.target.value)}
        />
        <Button asChild className="mt-2 w-full" disabled={!daoId.includes(".")}>
          <Link href={daoId.includes(".") ? `/dao/${daoId}` : "/dao"}>
            Open DAO <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </main>
  )
}
