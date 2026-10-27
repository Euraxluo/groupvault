"use client"

import { TipMemberButton } from "@/components/tip-member-button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function GroupRosterDialog({
  open,
  onOpenChange,
  owner,
  members,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  owner: string
  members: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-h-[85vh] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>成员 · 打赏</DialogTitle>
          <DialogDescription>
            付费进群成员列表。打赏是钱包直转 NEAR，不是金库提案。
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {members.length === 0 ? (
            <li className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              暂无成员
            </li>
          ) : (
            members.map((member) => (
              <li
                key={member}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs"
                data-roster-member={member}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-[11px] leading-snug">
                    {member}
                  </p>
                  {member === owner ? (
                    <Badge className="mt-1" variant="secondary">
                      Owner
                    </Badge>
                  ) : null}
                </div>
                <TipMemberButton receiverId={member} compact />
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
