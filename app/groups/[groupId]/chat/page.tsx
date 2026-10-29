"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { GroupChat } from "@/components/group-chat"
import { GroupOverviewSheet } from "@/components/group-overview-sheet"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function GroupChatPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = use(params)
  const numericId = Number(groupId)
  const [overviewOpen, setOverviewOpen] = useState(false)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/chat">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            消息
          </Link>
        </Button>
        <GroupChat
          groupId={Number.isFinite(numericId) ? numericId : 0}
          onOpenGroup={() => setOverviewOpen(true)}
        />
      </div>
      {Number.isFinite(numericId) ? (
        <GroupOverviewSheet
          groupId={numericId}
          open={overviewOpen}
          onOpenChange={setOverviewOpen}
        />
      ) : null}
    </main>
  )
}
