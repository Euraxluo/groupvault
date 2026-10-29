"use client"

import { useState } from "react"
import Link from "next/link"
import { Coins, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useGroupVault, useJoinGroup } from "@/hooks/use-group-vault"
import { useNearSession } from "@/hooks/use-near-session"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { getNearConfig } from "@/lib/near/config"
import { formatFtAmount, parseFtToBaseUnits } from "@/lib/near/format"
import { createGroupVaultClient } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"

export function GroupJoinCard({ groupId }: { groupId: number }) {
  const wallet = useNearWallet()
  const session = useNearSession()
  const { group, members, refresh, error: groupError } = useGroupVault(groupId)
  const { join, submitting, error } = useJoinGroup(groupId)
  const [amount, setAmount] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [justJoined, setJustJoined] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (!group) {
    return groupError ? (
      <Card className="shadow-none">
        <CardContent className="space-y-2 p-4 text-xs">
          <p className="font-medium">群信息读取失败</p>
          <p className="break-words text-muted-foreground">{groupError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
            重试
          </Button>
        </CardContent>
      </Card>
    ) : null
  }

  const isMember = Boolean(wallet.accountId && members.includes(wallet.accountId))
  const isOwner = wallet.accountId === group.owner
  const feeLabel = `${formatFtAmount(group.join_fee, 6)} 入群币`
  const amountLabel = amount.trim() || formatFtAmount(group.join_fee, 6)

  const submit = async () => {
    setLocalError(null)
    let baseUnits: string
    try {
      baseUnits = parseFtToBaseUnits(amountLabel, 6)
    } catch {
      setLocalError("请输入有效的入群币数量（最多 6 位小数）")
      return
    }
    if (BigInt(baseUnits) < BigInt(group.join_fee)) {
      setLocalError(`至少需要 ${feeLabel}`)
      return
    }
    try {
      await join(baseUnits)
    } catch {
      return
    }
    if (!session || !wallet.accountId) return

    // A submitted receipt is not membership: poll the chain view before chat.
    const config = getNearConfig()
    const client = createGroupVaultClient(
      session.selector,
      new NearRpc(config),
      config.groupVaultContractId,
    )
    setConfirming(true)
    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await refresh()
        if (await client.isMember(groupId, wallet.accountId)) {
          setJustJoined(true)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      setLocalError("交易已提交，但链上暂未确认成员资格。请稍后刷新重试。")
    } catch (reason) {
      setLocalError(
        `成员资格确认失败：${reason instanceof Error ? reason.message : String(reason)}`,
      )
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card className="border-amber-200/60 bg-amber-50/40 shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4" />
          付费进群
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-xs text-muted-foreground">
          入群费{" "}
          <span className="font-semibold text-foreground">{feeLabel}</span>
          <span className="mx-1">·</span>
          资产 <span className="font-mono">{group.join_ft}</span>
        </p>

        <p className="flex items-start gap-2 rounded-lg bg-white/60 p-2.5 text-[11px] leading-5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          付费进群只买成员资格，不等于投票权重；权重来自升级 DAO 后质押同一入群币。
        </p>

        {isMember ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {justJoined ? "已确认入群。" : "你已经是这个群的成员。"}
            </p>
            <Button asChild className="h-12 min-h-12 w-full rounded-xl text-base">
              <Link href={`/groups/${groupId}/chat`}>进入群聊</Link>
            </Button>
          </div>
        ) : (
          <>
            {!isOwner ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="join-amount"
                  className="text-[11px] text-muted-foreground"
                >
                  支付数量（入群币，可高于入群费）
                </label>
                <Input
                  id="join-amount"
                  inputMode="decimal"
                  placeholder={formatFtAmount(group.join_fee, 6)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            ) : null}
            <Button
              className="h-12 min-h-12 w-full rounded-xl text-base"
              disabled={
                !session || !wallet.accountId || submitting || isOwner || confirming
              }
              onClick={submit}
            >
              {isOwner
                ? "群主已是成员"
                : confirming
                  ? "等待链上确认…"
                  : submitting
                    ? "等待钱包…"
                    : `支付 ${amountLabel} 入群币并加入`}
            </Button>
          </>
        )}

        {!wallet.accountId ? (
          <p className="text-[11px] text-muted-foreground">
            先连接钱包才能支付入群费。
          </p>
        ) : null}
        {localError || error ? (
          <p className="text-xs text-destructive">{localError ?? error}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
