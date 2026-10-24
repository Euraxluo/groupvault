"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ChatIndexPage() {
  const [groupId, setGroupId] = useState("")
  const valid = /^\d+$/.test(groupId)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <PrivacyNotice compact />
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <Input
              inputMode="numeric"
              placeholder="Group ID"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            />
            <Button asChild className="w-full" disabled={!valid}>
              <Link href={valid ? `/groups/${groupId}/chat` : "/chat"}>
                Open public chat <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
