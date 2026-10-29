"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { GroupJoinCard } from "@/components/group-join-card"
import { MobileNavbar } from "@/components/mobile-navbar"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useGroupVault } from "@/hooks/use-group-vault"
import { formatFtAmount } from "@/lib/near/format"

export default function GroupJoinPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId: raw } = use(params)
  const groupId = Number(raw)
  const { group, loading, error } = useGroupVault(
    Number.isFinite(groupId) ? groupId : undefined,
  )

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/discover">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回发现
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">付费进群</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            支付入群币后成为成员，然后进入群聊。付费不等于投票权重。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">正在读取群信息…</p>
        ) : error || !group ? (
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="font-medium">群不存在或读取失败</p>
              <p className="text-xs text-muted-foreground">
                {error ?? `没有 ID 为 ${raw} 的群。`}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/discover">发现公开群</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-none">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.description || "群主还没有写简介"}
                    </p>
                  </div>
                  <Badge variant={group.dao_id ? "default" : "secondary"}>
                    {group.dao_id ? "已是 DAO" : "群聊"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  群 #{group.id} · {group.member_count} 位成员 · 入群费{" "}
                  {formatFtAmount(group.join_fee, 6)} 入群币
                </p>
              </CardContent>
            </Card>
            <GroupJoinCard groupId={groupId} />
            <PrivacyNotice compact />
          </>
        )}
      </div>
    </main>
  )
}
