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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            Membership is a paid group role. Tip sends a direct wallet NEAR
            transfer to that member — not a treasury proposal.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-auto">
          {members.map((member) => (
            <li
              key={member}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all font-mono">{member}</p>
                {member === owner ? (
                  <Badge className="mt-1" variant="secondary">
                    Owner
                  </Badge>
                ) : null}
              </div>
              <TipMemberButton receiverId={member} compact />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
