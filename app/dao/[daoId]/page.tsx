"use client"

import { use } from "react"
import {
  ArrowRight,
  Coins,
  KeyRound,
  ShieldCheck,
  Vote,
} from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDao } from "@/hooks/use-dao"

export default function DaoOverviewPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)
  const dao = useDao(daoId)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DAO 总览</h1>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {daoId}
          </p>
        </div>

        {dao.error ? (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">RPC / load failed</p>
            <p className="break-words text-[11px] text-destructive/90">{dao.error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 min-h-10 w-full rounded-xl"
              onClick={() => void dao.refresh()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-4">
              <Vote className="h-4 w-4 text-primary" />
              <p className="mt-3 text-[10px] uppercase text-muted-foreground">
                投票规则
              </p>
              <p className="text-sm font-bold">
                {dao.error ? "—" : (dao.policy?.default_vote_policy.weight_kind ?? (dao.loading ? "Loading…" : "—"))}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4">
              <Coins className="h-4 w-4 text-emerald-600" />
              <p className="mt-3 text-[10px] uppercase text-muted-foreground">
                你的委托
              </p>
              <p className="truncate text-sm font-bold">{dao.delegation}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4" /> 质押
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-xs">
            <p className="text-muted-foreground">
              {dao.error
                ? "质押状态读取失败，请重试；不要把它当作未设置。"
                : dao.loading
                  ? "正在读取质押合约…"
                  : dao.stakingContract
                    ? "质押已设置，投票权重只来自入群币质押。"
                    : "还未设置质押；理事会需先批准 SetStakingContract。"}
            </p>
            <p className="break-all font-mono">
              {dao.error
                ? "状态未知"
                : dao.loading
                  ? "…"
                  : (dao.stakingContract ?? "not set")}
            </p>
            <Badge
              variant={
                dao.error || dao.loading
                  ? "outline"
                  : dao.stakingContract
                    ? "default"
                    : "secondary"
              }
            >
              {dao.error
                ? "读取失败"
                : dao.loading
                  ? "加载中"
                  : dao.stakingContract
                    ? "已就绪"
                    : "待设置"}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Button asChild>
            <Link href={`/dao/${daoId}/staking/setup`}>
              <ShieldCheck className="mr-2 h-4 w-4" /> 质押设置
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/stake`}>
              <Coins className="mr-2 h-4 w-4" /> 质押 / 委托
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/treasury`}>
              金库与转账 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dao/${daoId}/proposals`}>
              <Vote className="mr-2 h-4 w-4" /> 提案
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
