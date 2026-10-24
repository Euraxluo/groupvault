"use client"

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
            Membership is a paid group role. It is separate from the DAO council
            and from voting weight.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-2 overflow-auto">
          {members.map((member) => (
            <li
              key={member}
              className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
            >
              <span className="break-all font-mono">{member}</span>
              {member === owner ? <Badge>Owner</Badge> : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
