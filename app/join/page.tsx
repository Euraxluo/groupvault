"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function JoinEntryPage() {
  const [groupId, setGroupId] = useState("")
  const valid = /^\d+$/.test(groupId)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">Join a group</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the on-chain group ID. The join is one FT transfer call signed by
          your wallet.
        </p>
        <Card className="mt-5 shadow-none">
          <CardContent className="space-y-3 p-4">
            <Input
              inputMode="numeric"
              placeholder="Group ID"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            />
            <Button asChild className="w-full" disabled={!valid}>
              <Link href={valid ? `/groups/${groupId}` : "/join"}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Wrong token, bad message, duplicate membership, or underpayment is
              refunded in full by the contract.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
