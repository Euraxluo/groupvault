"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { GroupChat } from "@/components/group-chat"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function GroupChatPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = use(params)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Group overview
          </Link>
        </Button>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Group chat</h1>
        <GroupChat groupId={Number(groupId)} />
      </div>
    </main>
  )
}
