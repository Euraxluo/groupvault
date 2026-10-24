"use client"

import { useState } from "react"
import { AlertCircle, LogOut, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNearWallet } from "@/hooks/use-near-wallet"

export interface ConnectWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function shortAccount(accountId: string): string {
  if (accountId.length <= 18) return accountId
  return `${accountId.slice(0, 8)}…${accountId.slice(-6)}`
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const wallet = useNearWallet()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>NEAR wallet</DialogTitle>
          <DialogDescription>
            The wallet extension is the only signer. GroupVault never sees or
            stores a seed phrase or private key.
          </DialogDescription>
        </DialogHeader>

        {wallet.accountId ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Connected account
            </p>
            <p className="mt-1 break-all font-mono text-sm">{wallet.accountId}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No wallet connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose MyNearWallet and approve the connection in the wallet.
            </p>
          </div>
        )}

        {wallet.error ? (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {wallet.error}
          </p>
        ) : null}

        <DialogFooter>
          {wallet.accountId ? (
            <Button
              variant="outline"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true)
                await wallet.disconnect()
                setSigningOut(false)
                onOpenChange(false)
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button
              disabled={!wallet.ready || wallet.connecting}
              onClick={wallet.connect}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {wallet.connecting ? "Waiting for wallet…" : "Connect wallet"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
