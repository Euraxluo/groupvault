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

  const isSelf = Boolean(wallet.accountId && receiverId === wallet.accountId)
  const connected = Boolean(session && wallet.accountId)
  const disabled =
    busy || !connected || isSelf || !/^\d+$/.test(amount)

  const send = async () => {
    if (!session || !wallet.accountId) {
      setError("请先连接钱包再打赏")
      return
    }
    if (isSelf) {
      setError("不能给自己打赏")
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
    <div
      className={
        compact
          ? "shrink-0 space-y-1 text-right"
          : "space-y-2"
      }
      data-tip-receiver={receiverId}
    >
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
        type="button"
        size="sm"
        variant="outline"
        className={
          compact
            ? "h-10 min-h-10 min-w-[4.5rem] px-3 text-xs font-medium"
            : "h-11 min-h-11 px-4 text-sm font-medium"
        }
        disabled={disabled}
        onClick={() => void send()}
        aria-label={
          !connected
            ? "Connect wallet to tip"
            : isSelf
              ? "Cannot tip yourself"
              : `Tip ${receiverId}`
        }
        title={
          !connected
            ? "请先连接钱包"
            : isSelf
              ? "不能给自己打赏"
              : "直接转账 NEAR（非金库提案）"
        }
      >
        {busy ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Gift className="mr-1 h-3.5 w-3.5" />
        )}
        {isSelf ? "自己" : (<><span className="sr-only">Tip </span>打赏</>)}
      </Button>
      {error ? (
        <p className="max-w-[9rem] text-[10px] leading-tight text-destructive">
          {error}
        </p>
      ) : null}
      {tx ? (
        <p
          className="max-w-[9rem] break-all font-mono text-[10px] leading-tight text-emerald-700"
          data-tip-tx={tx}
        >
          tx {tx}
        </p>
      ) : null}
    </div>
  )
}
