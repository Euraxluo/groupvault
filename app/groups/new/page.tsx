"use client"

import { Plus } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateGroupDialog } from "@/components/create-group-dialog"
import { useState } from "react"

export default function NewGroupPage() {
  const [open, setOpen] = useState(true)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">New group</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          One wallet signature creates the group. Convert is a later, separate
          owner action.
        </p>
        <Card className="mt-5 border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Create with your wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The join fee is denominated in the configured NEP-141 token. Paid
              membership never creates voting weight.
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Open create form
            </Button>
          </CardContent>
        </Card>
      </div>
      <CreateGroupDialog open={open} onOpenChange={setOpen} />
    </main>
  )
}
