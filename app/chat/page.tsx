"use client"

import { Plus } from "lucide-react"
import Link from "next/link"

import { GroupList } from "@/components/group-list"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function ChatIndexPage() {
  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">消息</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              付费进群聊天，成熟了就一键变成 DAO。
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/groups/new">
              <Plus className="mr-1 h-4 w-4" />
              新建群
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">想加入新群？</span>
          <Link href="/discover" className="font-medium underline-offset-4 hover:underline">
            发现群
          </Link>
        </div>
        <GroupList mode="messages" />
      </div>
    </main>
  )
}
