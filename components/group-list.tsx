"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Plus, RotateCw, Users } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNearSession } from "@/hooks/use-near-session"
import { getNearConfig } from "@/lib/near/config"
import { formatFtAmount } from "@/lib/near/format"
import { createGroupVaultClient, type GroupView } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"

export type GroupListMode = "messages" | "discover"

export function GroupList({ mode = "discover" }: { mode?: GroupListMode }) {
  const session = useNearSession()
  const [groups, setGroups] = useState<GroupView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("群合约尚未配置")
      setLoading(false)
      return
    }
    if (!session) return

    setLoading(true)
    createGroupVaultClient(session.selector, new NearRpc(config), config.groupVaultContractId)
      .getGroups(0, 50)
      .then((next) => {
        if (cancelled) return
        setGroups(next)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session, attempt])

  if (loading) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="p-6 text-sm text-muted-foreground">
          正在读取链上群列表…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-none">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium text-destructive">群列表读取失败</p>
          <p className="break-words text-xs text-destructive/90">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (groups.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-medium">付费进群聊天，成熟了就一键变成 DAO</p>
          <p className="text-xs text-muted-foreground">
            合约上还没有群。先发现公开群，或者自己开一个。
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/discover">发现群</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/groups/new">
                <Plus className="mr-1 h-4 w-4" />
                新建群
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-2.5">
      <p className="px-1 text-[11px] text-muted-foreground">
        当前合约最近 {groups.length} 个群（按创建顺序，上限 50）。
        {mode === "messages"
          ? "尚未按成员关系过滤，点进群聊即读取真实消息。"
          : "所有群均公开可见，进群需要支付入群币。"}
      </p>
      {groups.map((group) => {
        const href =
          mode === "messages" ? `/groups/${group.id}/chat` : `/groups/${group.id}/join`
        return (
          <Link key={group.id} href={href} className="block">
            <Card className="shadow-none transition-colors hover:bg-accent/40">
              <CardHeader className="p-4 pb-1">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="truncate text-sm">{group.name}</CardTitle>
                  <Badge variant={group.dao_id ? "default" : "secondary"}>
                    {group.dao_id ? "DAO" : group.convert_pending ? "升级中" : "群聊"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 p-4 pt-1.5 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {group.member_count} 位成员 · 入群费{" "}
                  {formatFtAmount(group.join_fee, 6)} 入群币
                </span>
                <span className="flex shrink-0 items-center gap-1 text-foreground">
                  {mode === "messages" ? "进入聊天" : "查看并加入"}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
