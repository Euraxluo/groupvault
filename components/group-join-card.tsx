"use client"

import { useState } from "react"
import { Coins, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useJoinGroup } from "@/hooks/use-group-vault"
import { useGroupVault } from "@/hooks/use-group-vault"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { useNearSession } from "@/hooks/use-near-session"

export function GroupJoinCard({ groupId }: { groupId: number }) {
  const wallet = useNearWallet()
  const session = useNearSession()
  const { group, members, refresh } = useGroupVault(groupId)
  const { join, submitting, error } = useJoinGroup(groupId)
  const [amount, setAmount] = useState("")

  if (!group) return null
  const isMember = Boolean(
    wallet.accountId && members.includes(wallet.accountId),
  )
  const isOwner = wallet.accountId === group.owner

  return (
    <Card className="border-amber-200/60 bg-amber-50/40 shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4" />
          Paid join
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-xs text-muted-foreground">
          Exact token: <span className="font-mono">{group.join_ft}</span> ·{" "}
          {group.join_fee} base units
        </p>

        <p className="flex items-start gap-2 rounded-lg bg-white/60 p-2.5 text-[11px] leading-5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          Paid membership is not voting weight. Weight comes only from staking
          the same FT after Convert.
        </p>

        {isMember ? (
          <p className="text-xs font-medium text-emerald-700">
            You are a member of this group.
          </p>
        ) : (
          <>
            {!isOwner ? (
              <Input
                inputMode="numeric"
                placeholder={group.join_fee}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            ) : null}
            <Button
              className="h-12 min-h-12 w-full rounded-xl text-base"
              disabled={!session || !wallet.accountId || submitting || isOwner}
              onClick={async () => {
                await join(amount || group.join_fee)
                await refresh()
              }}
            >
              {isOwner
                ? "Owner is already a member"
                : submitting
                  ? "Waiting for wallet…"
                  : "Pay and join"}
            </Button>
          </>
        )}

        {!wallet.accountId ? (
          <p className="text-[11px] text-muted-foreground">
            Connect a wallet to join.
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
