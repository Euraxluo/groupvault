"use client"

import Link from "next/link"

import { DemoStoryRail } from "@/components/demo-story-rail"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DEMO_STORY } from "@/lib/demo-story"

export default function DemoStoryPage() {
  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-28 pt-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demo story</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Click through every product surface with real CTAs. Anchors come from
            the verified testnet run (group {DEMO_STORY.groupId}).
          </p>
        </div>

        <Card className="border-dashed shadow-none">
          <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
            <p>
              Prefer Keypair (demo) for unattended browser proof. MyNearWallet
              stays the product default. No mock chain — empty or blocked states
              are honest.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/groups/new">Create fresh group</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/groups/${DEMO_STORY.groupId}`}>
                  Open demo group {DEMO_STORY.groupId}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dao/${DEMO_STORY.daoId}`}>Open demo DAO</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <DemoStoryRail />
      </div>
    </main>
  )
}
