"use client"

import { useState } from "react"
import { Gift, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useNearSession } from "@/hooks/use-near-session"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { tipMember } from "@/lib/near/treasury"

/** Default tip: 0.01 NEAR in yocto. */
const DEFAULT_TIP = "10000000000000000000000"

export function TipMemberButton({
  receiverId,
  compact = false,
}: {
  receiverId: string
  compact?: boolean
}) {
  const wallet = useNearWallet()
  const session = useNearSession()
  const [amount, setAmount] = useState(DEFAULT_TIP)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)

  const disabled =
    busy ||
    !session ||
    !wallet.accountId ||
    receiverId === wallet.accountId ||
    !/^\d+$/.test(amount)

  const send = async () => {
    if (!session || !wallet.accountId) {
      setError("Connect a wallet to tip")
      return
    }
    setBusy(true)
    setError(null)
    setTx(null)
    try {
      const receipt = await tipMember(
        session.selector,
        wallet.accountId,
        receiverId,
        amount,
      )
      setTx(receipt.transactionHash || "submitted")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {!compact ? (
        <Input
          inputMode="numeric"
          className="h-11 min-h-11 text-sm"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="yoctoNEAR"
        />
      ) : null}
      <Button
        size="sm"
        variant="outline"
        className={compact ? "h-9 min-h-9 px-3 text-xs" : "h-11 min-h-11 px-4 text-sm"}
        disabled={disabled}
        onClick={() => void send()}
        title={
          !wallet.accountId
            ? "Connect a wallet to tip"
            : receiverId === wallet.accountId
              ? "Cannot tip yourself"
              : "Direct wallet NEAR transfer"
        }
      >
        {busy ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Gift className="mr-1 h-3 w-3" />
        )}
        Tip
      </Button>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      {tx ? (
        <p className="break-all font-mono text-[10px] text-emerald-700">
          tx {tx}
        </p>
      ) : null}
    </div>
  )
}
