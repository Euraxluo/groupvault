"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, KeyRound, RotateCw, Users, Wallet } from "lucide-react"

import { TipMemberButton } from "@/components/tip-member-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useGroupVault } from "@/hooks/use-group-vault"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { formatFtAmount } from "@/lib/near/format"

const PREVIEW_MEMBERS = 5

export function GroupOverviewSheet({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const wallet = useNearWallet()
  const { group, members, loading, error, refresh } = useGroupVault(groupId)
  const [showAllMembers, setShowAllMembers] = useState(false)

  const isOwner = Boolean(wallet.accountId && group?.owner === wallet.accountId)
  const isMember = Boolean(wallet.accountId && members.includes(wallet.accountId))
  const visibleMembers = showAllMembers ? members : members.slice(0, PREVIEW_MEMBERS)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {loading && !group ? (
          <div className="space-y-3 py-6 text-sm text-muted-foreground">
            <SheetTitle className="text-base">正在读取群概况…</SheetTitle>
            <p>真实成员与入群费来自链上，稍等片刻。</p>
          </div>
        ) : error && !group ? (
          <div className="space-y-3 py-2">
            <SheetTitle className="text-base">群概况读取失败</SheetTitle>
            <SheetDescription className="break-words">{error}</SheetDescription>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        ) : group ? (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl">{group.name}</SheetTitle>
                  <SheetDescription>
                    {group.dao_id
                      ? "已是 DAO"
                      : group.convert_pending
                        ? "升级进行中"
                        : "付费群聊"}
                    {group.description ? ` · ${group.description}` : ""}
                  </SheetDescription>
                </div>
                <Badge variant={group.dao_id ? "default" : "secondary"} className="shrink-0">
                  {group.dao_id ? "DAO" : group.convert_pending ? "升级中" : "群聊"}
                </Badge>
              </div>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">成员</p>
                <p className="mt-0.5 text-lg font-semibold">{group.member_count}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">入群费</p>
                <p className="mt-0.5 text-lg font-semibold">
                  {formatFtAmount(group.join_fee, 6)} 入群币
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2" data-inline-roster>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  成员名单
                </p>
                {members.length > PREVIEW_MEMBERS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setShowAllMembers((value) => !value)}
                  >
                    {showAllMembers ? "收起" : `查看全部 ${members.length} 位`}
                  </Button>
                ) : null}
              </div>
              <ul className="max-h-[16rem] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
                {visibleMembers.length === 0 ? (
                  <li className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    暂无成员
                  </li>
                ) : (
                  visibleMembers.map((member) => (
                    <li
                      key={member}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-xs"
                      data-roster-member={member}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-mono text-[11px] leading-snug">
                          {member}
                        </p>
                        {member === group.owner ? (
                          <Badge className="mt-1" variant="secondary">
                            群主
                          </Badge>
                        ) : null}
                      </div>
                      <TipMemberButton receiverId={member} compact />
                    </li>
                  ))
                )}
              </ul>
              <p className="text-[10px] leading-snug text-muted-foreground">
                打赏是钱包直转 NEAR，不是金库提案。
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {!isMember ? (
                <Button asChild className="h-12 min-h-12 w-full rounded-xl text-base">
                  <Link href={`/groups/${groupId}/join`}>
                    <Wallet className="mr-2 h-4 w-4" />
                    加入群 · {formatFtAmount(group.join_fee, 6)} 入群币
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="h-12 min-h-12 w-full rounded-xl">
                  <Link href={`/groups/${groupId}/chat`}>
                    回到群聊
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}

              {group.dao_id ? (
                <>
                  <Button asChild className="h-12 min-h-12 w-full rounded-xl text-base">
                    <Link href={`/dao/${group.dao_id}`}>
                      金库与投票
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dao/${group.dao_id}/treasury`}>金库</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dao/${group.dao_id}/proposals`}>提案</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dao/${group.dao_id}/stake`}>质押</Link>
                    </Button>
                  </div>
                </>
              ) : null}

              {isOwner && !group.dao_id && !group.convert_pending ? (
                <Button asChild variant="outline" className="h-12 min-h-12 w-full rounded-xl">
                  <Link href={`/groups/${groupId}/convert`}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    升级为 DAO
                  </Link>
                </Button>
              ) : null}
            </div>

            {error ? (
              <p className="mt-3 break-words text-xs text-destructive">{error}</p>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
