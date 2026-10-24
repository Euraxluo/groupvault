"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { CreateGroupDialog } from "@/components/create-group-dialog"
import { GroupList } from "@/components/group-list"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function GroupsPage() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-20">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Bounded on-chain discovery, newest ID last.
            </p>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>
        <GroupList />
      </div>
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  )
}
