"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Coins, MessageSquareText, RefreshCw } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { GroupTreasury } from "@/components/group-treasury"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getNearConfig } from "@/lib/near/config"
import { formatNearAmount } from "@/lib/near/format"
import { NearRpc } from "@/lib/near/rpc"

interface BalanceState {
  loading: boolean
  value: bigint | null
  error: string | null
}

export default function TreasuryPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)
  const searchParams = useSearchParams()
  const fromConvert = searchParams.get("from") === "convert"
  const groupId = searchParams.get("groupId")
  const backHref = /^\d+$/.test(groupId ?? "") ? `/groups/${groupId}/chat` : "/chat"

  const [balance, setBalance] = useState<BalanceState>({
    loading: true,
    value: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setBalance({ loading: true, value: null, error: null })
    new NearRpc(getNearConfig())
      .accountBalance(daoId)
      .then((value) => {
        if (!cancelled) setBalance({ loading: false, value, error: null })
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setBalance({
            loading: false,
            value: null,
            error: reason instanceof Error ? reason.message : String(reason),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [daoId, attempt])

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {fromConvert ? "回到聊天" : "返回"}
          </Link>
        </Button>

        {fromConvert ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">升级成功</h1>
              <Badge>DAO</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              群已升级为 DAO。金库从这里开始，成员可以在二级页发起提案和质押。
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">金库</h1>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {daoId}
            </p>
          </div>
        )}

        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              DAO 金库余额
            </p>
            {balance.loading ? (
              <p className="text-sm text-muted-foreground">正在读取链上余额…</p>
            ) : balance.error ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">余额暂不可用</p>
                <p className="break-words text-[11px] text-muted-foreground">
                  {balance.error}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  重试
                </Button>
              </div>
            ) : (
              <div>
                <p className="font-mono text-2xl font-semibold">
                  {formatNearAmount(balance.value ?? 0n)} NEAR
                </p>
                {balance.value === 0n ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    金库当前为空，可以从下方转入第一笔资金。
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {fromConvert ? (
          <>
            <Button asChild className="h-12 min-h-12 w-full rounded-xl text-base">
              <Link href={backHref}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                回到聊天
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dao/${daoId}/proposals`}>提案</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dao/${daoId}/staking/setup`}>质押设置</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dao/${daoId}/stake`}>质押</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dao/${daoId}`}>DAO 总览</Link>
              </Button>
            </div>
          </>
        ) : null}

        <GroupTreasury daoId={daoId} />
      </div>
    </main>
  )
}
