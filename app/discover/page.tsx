"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { GroupList } from "@/components/group-list"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">发现</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              发现公开群。加入前先付入群币，付费只买成员资格，不产生投票权重。
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/groups/new">
              <Plus className="mr-1 h-4 w-4" />
              新建群
            </Link>
          </Button>
        </div>
        <GroupList mode="discover" />
      </div>
    </main>
  )
}
