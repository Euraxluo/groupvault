"use client"

import { useState } from "react"
import { AlertCircle, KeyRound, LogOut, Wallet } from "lucide-react"

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
  const [showKeypair, setShowKeypair] = useState(false)
  const [accountIdInput, setAccountIdInput] = useState("")
  const [privateKeyInput, setPrivateKeyInput] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>NEAR wallet</DialogTitle>
          <DialogDescription>
            Use MyNearWallet for normal signing, or Keypair (demo) on testnet
            for hackathon/e2e without a browser extension. Demo keys stay in
            this tab&apos;s sessionStorage only.
          </DialogDescription>
        </DialogHeader>

        {wallet.accountId ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Connected account
              {wallet.keypairMode ? " · keypair (demo)" : ""}
            </p>
            <p className="mt-1 break-all font-mono text-sm">{wallet.accountId}</p>
          </div>
        ) : showKeypair ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium">Keypair (demo) · testnet only</p>
            <div className="space-y-1.5">
              <Label htmlFor="gv-demo-account">Account ID</Label>
              <Input
                id="gv-demo-account"
                autoComplete="off"
                placeholder="gv-a-….testnet"
                value={accountIdInput}
                onChange={(event) => setAccountIdInput(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-demo-secret">Private key</Label>
              <Input
                id="gv-demo-secret"
                type="password"
                autoComplete="off"
                placeholder="ed25519:…"
                value={privateKeyInput}
                onChange={(event) => setPrivateKeyInput(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a funded testnet key for this session. Never commit keys to
              git.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No wallet connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose MyNearWallet, or Keypair (demo) for local testnet signing.
            </p>
          </div>
        )}

        {wallet.error ? (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {wallet.error}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {wallet.accountId ? (
            <Button
              variant="outline"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true)
                await wallet.disconnect()
                setSigningOut(false)
                setShowKeypair(false)
                setPrivateKeyInput("")
                onOpenChange(false)
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : showKeypair ? (
            <>
              <Button
                disabled={
                  !wallet.ready ||
                  wallet.connecting ||
                  !accountIdInput.trim() ||
                  !privateKeyInput.trim()
                }
                onClick={async () => {
                  try {
                    await wallet.connectKeypair({
                      accountId: accountIdInput,
                      privateKey: privateKeyInput,
                    })
                    setPrivateKeyInput("")
                    onOpenChange(false)
                  } catch {
                    // error surfaced via wallet.error
                  }
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {wallet.connecting ? "Connecting…" : "Connect keypair"}
              </Button>
              <Button
                variant="ghost"
                disabled={wallet.connecting}
                onClick={() => setShowKeypair(false)}
              >
                Back
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={!wallet.ready || wallet.connecting}
                onClick={wallet.connect}
              >
                <Wallet className="mr-2 h-4 w-4" />
                {wallet.connecting ? "Waiting for wallet…" : "Connect wallet"}
              </Button>
              <Button
                variant="outline"
                disabled={!wallet.ready || wallet.connecting}
                onClick={() => setShowKeypair(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Keypair (demo)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
