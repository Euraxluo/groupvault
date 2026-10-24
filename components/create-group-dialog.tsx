"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateGroup } from "@/hooks/use-group-vault"
import { getNearConfig } from "@/lib/near/config"
import { CREATE_GROUP_DEPOSIT } from "@/lib/near/deposits"

export interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const router = useRouter()
  const config = getNearConfig()
  const { create, submitting, error } = useCreateGroup()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [joinFee, setJoinFee] = useState("1000000")
  const [members, setMembers] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async () => {
    setLocalError(null)
    if (!name.trim()) {
      setLocalError("Group name is required")
      return
    }
    if (!/^\d+$/.test(joinFee)) {
      setLocalError("Join fee must be whole base units")
      return
    }
    if (!config.joinFtContractId) {
      setLocalError("Join FT is not configured yet")
      return
    }
    const initialMembers = members
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    try {
      const receipt = await create(
        {
          name: name.trim(),
          description: description.trim(),
          joinFee,
          joinFt: config.joinFtContractId,
          initialMembers,
        },
        CREATE_GROUP_DEPOSIT,
      )
      onOpenChange(false)
      router.push(
        receipt.groupId === null ? "/groups" : `/groups/${receipt.groupId}`,
      )
    } catch {
      // The hook exposes the wallet/RPC error; do not invent success.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a paid group</DialogTitle>
          <DialogDescription>
            The wallet signs one create_group call. Convert later is a separate
            owner action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Builders"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this paid group for?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-fee">Join fee (FT base units)</Label>
            <Input
              id="join-fee"
              inputMode="numeric"
              value={joinFee}
              onChange={(event) => setJoinFee(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Paid membership does not create voting weight.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial-members">Initial account IDs (optional)</Label>
            <Textarea
              id="initial-members"
              value={members}
              onChange={(event) => setMembers(event.target.value)}
              placeholder="alice.testnet, bob.testnet"
            />
          </div>
        </div>

        {error || localError ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {localError ?? error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Waiting for wallet…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
