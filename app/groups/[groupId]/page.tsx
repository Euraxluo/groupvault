"use client"

import { use, useState } from "react"
import {
  ArrowRight,
  KeyRound,
  MessageSquareText,
  Coins,
  Vote,
} from "lucide-react"
import Link from "next/link"

import { GroupDetailsDialog } from "@/components/group-details-dialog"
import { GroupJoinCard } from "@/components/group-join-card"
import { MobileNavbar } from "@/components/mobile-navbar"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useGroupVault } from "@/hooks/use-group-vault"
import { useNearWallet } from "@/hooks/use-near-wallet"

export default function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId: raw } = use(params)
  const groupId = Number(raw)
  const { group, members, loading, error } = useGroupVault(groupId)
  const wallet = useNearWallet()
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <MobileNavbar />
        <p className="mx-auto max-w-2xl px-4 pt-24 text-sm text-muted-foreground">
          Loading group…
        </p>
      </main>
    )
  }

  if (error || !group) {
    const networkish = Boolean(
      error && /Failed to fetch|fetch failed|NetworkError|429|Rate limit|RPC/i.test(error),
    )
    return (
      <main className="min-h-screen bg-background">
        <MobileNavbar />
        <div className="mx-auto max-w-2xl px-4 pt-24">
          <h1 className="text-xl font-bold">
            {networkish ? "网络繁忙" : "Group not found"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {networkish
              ? "链上节点暂时拉不到群信息，请稍后重试。"
              : (error ?? `No group with ID ${raw}.`)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {networkish ? (
              <Button
                type="button"
                className="h-11 rounded-xl"
                onClick={() => window.location.reload()}
              >
                重试
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link href="/groups">Back to groups</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const isOwner = wallet.accountId === group.owner
  const isMember = Boolean(
    wallet.accountId && members.includes(wallet.accountId),
  )

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.description || "No description"}
            </p>
          </div>
          <Badge variant={group.dao_id ? "default" : "secondary"}>
            {group.dao_id ? "DAO" : group.convert_pending ? "Converting" : "Group"}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-none">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Members</p>
              <p className="text-lg font-bold">{group.member_count}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Join fee</p>
              <p className="truncate text-lg font-bold">{group.join_fee}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Group ID</p>
              <p className="text-lg font-bold">{group.id}</p>
            </CardContent>
          </Card>
        </div>

        {!isMember ? <GroupJoinCard groupId={groupId} /> : null}
        <PrivacyNotice compact />

        <div className="grid gap-2 sm:grid-cols-2">
          {!isMember ? (
            <Button asChild className="h-11 min-h-11 rounded-xl">
              <Link href={`/groups/${groupId}/join`}>
                <Coins className="mr-2 h-4 w-4" /> Paid join wall
              </Link>
            </Button>
          ) : (
            <Button asChild className="h-11 min-h-11 rounded-xl">
              <Link href={`/groups/${groupId}/chat`}>
                <MessageSquareText className="mr-2 h-4 w-4" /> Chat
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => setDetailsOpen(true)}>
            Details / roster <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {isOwner && !group.dao_id ? (
            <Button asChild className="h-11 min-h-11 rounded-xl">
              <Link href={`/groups/${groupId}/convert`}>
                <KeyRound className="mr-2 h-4 w-4" /> Convert to DAO
              </Link>
            </Button>
          ) : null}
          {group.dao_id ? (
            <Button asChild className="h-11 min-h-11 rounded-xl">
              <Link href={`/dao/${group.dao_id}`}>
                <Vote className="mr-2 h-4 w-4" /> Open DAO hub
              </Link>
            </Button>
          ) : null}
          {isOwner && group.dao_id ? (
            <Button asChild variant="outline" className="h-11 min-h-11 rounded-xl">
              <Link href={`/groups/${groupId}/convert`}>Convert status</Link>
            </Button>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Members on chain: {members.length} · DAO:{" "}
          <span className="font-mono">{group.dao_id ?? "not converted"}</span>
          {!wallet.accountId
            ? " · Connect a wallet to join, chat, or convert."
            : null}
        </p>
      </div>

      <GroupDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        groupId={groupId}
      />
    </main>
  )
}
