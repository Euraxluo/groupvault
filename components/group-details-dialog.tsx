"use client"

import { useEffect, useState } from "react"
import { Copy, MessageSquareText, Users } from "lucide-react"
import Link from "next/link"

import { GroupRosterDialog } from "@/components/group-roster-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useGroupVault } from "@/hooks/use-group-vault"

export function GroupDetailsDialog({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: number | null
}) {
  const { group, members } = useGroupVault(groupId ?? undefined)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (groupId === null || !group) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{group.name}</DialogTitle>
            <DialogDescription>{group.description || "No description"}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Badge variant={group.dao_id ? "default" : "secondary"}>
              {group.dao_id ? "Converted" : group.convert_pending ? "Converting" : "Pre-DAO"}
            </Badge>
            <Badge variant="outline">{group.member_count} members</Badge>
            <Badge variant="outline">{group.join_fee} base units</Badge>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">Owner</p>
            <p className="break-all font-mono">{group.owner}</p>
            <Separator />
            <p className="text-muted-foreground">DAO</p>
            <p className="break-all font-mono">
              {group.dao_id ?? "Not converted yet"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setRosterOpen(true)}>
              <Users className="mr-1.5 h-3.5 w-3.5" /> Roster
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(String(groupId))
                setCopied(true)
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "Copied" : "Group ID"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/groups/${groupId}/join`}>Join wall</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/groups/${groupId}/convert`}>Convert</Link>
            </Button>
            <Button asChild size="sm" className="col-span-2">
              <Link href={`/groups/${groupId}/chat`}>
                <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                Open public chat
              </Link>
            </Button>
            {group.dao_id ? (
              <Button asChild size="sm" className="col-span-2" variant="secondary">
                <Link href={`/dao/${group.dao_id}`}>Open DAO hub</Link>
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <GroupRosterDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        owner={group.owner}
        members={members}
      />
    </>
  )
}
