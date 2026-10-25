"use client"

import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"

import { GroupList } from "@/components/group-list"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Public on-chain groups. Join opens the paid wall. Indexer lag may
              delay chat history, not membership views.
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/groups/new">
              <Plus className="mr-1 h-4 w-4" /> New
            </Link>
          </Button>
        </div>

        <Card className="shadow-none">
          <CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
            <p className="text-muted-foreground">
              Already a member? Jump to your groups list.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/groups">
                My groups <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <GroupList />
      </div>
    </main>
  )
}
