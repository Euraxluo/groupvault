"use client"

import { useEffect, useState } from "react"
import { Copy, MessageSquareText, Users } from "lucide-react"
import Link from "next/link"

import { TipMemberButton } from "@/components/tip-member-button"
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
    if (!open) {
      setCopied(false)
      setRosterOpen(false)
    }
  }, [open])

  if (groupId === null || !group) return null

  const openRoster = () => {
    // Close details first so nested Dialog overlays (same z-50) do not hide Tip.
    onOpenChange(false)
    // Defer open so Radix unmounts the parent overlay before roster mounts.
    window.setTimeout(() => setRosterOpen(true), 50)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{group.name}</DialogTitle>
            <DialogDescription>
              {group.description || "No description"}
            </DialogDescription>
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

          {/* Inline members + Tip: visible after one tap on Details / roster */}
          <div className="space-y-2" data-inline-roster>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                成员 · 打赏
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={openRoster}
              >
                <Users className="mr-1 h-3.5 w-3.5" />
                全屏名单
              </Button>
            </div>
            <ul className="max-h-52 space-y-2 overflow-y-auto overscroll-contain">
              {members.map((member) => (
                <li
                  key={member}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
                  data-roster-member={member}
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-mono text-[11px] leading-snug">
                      {member}
                    </p>
                    {member === group.owner ? (
                      <Badge className="mt-1" variant="secondary">
                        Owner
                      </Badge>
                    ) : null}
                  </div>
                  <TipMemberButton receiverId={member} compact />
                </li>
              ))}
            </ul>
            <p className="text-[10px] leading-snug text-muted-foreground">
              打赏是钱包直转 NEAR，不是金库提案。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openRoster}
            >
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
