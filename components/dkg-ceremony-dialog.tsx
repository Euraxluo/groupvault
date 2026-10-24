"use client"

import { Ban, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Deliberately inert. The previous product used a threshold-key ceremony here;
 * GroupVault does not. This component cannot sign or transact.
 */
export function DkgCeremonyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4" /> No key ceremony
          </DialogTitle>
          <DialogDescription>
            GroupVault Convert is one Sputnik factory.create call. There is no
            distributed-key, threshold-signature, or key-resharing step in this
            product.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl bg-muted p-4 text-xs">
          {[
            "No distributed key generation",
            "No threshold signature aggregation",
            "No server-held shares",
            "Only the owner's wallet signature",
          ].map((item) => (
            <p key={item} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {item}
            </p>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
