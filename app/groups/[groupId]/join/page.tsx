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
          <Link href={`/groups/${raw}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Group overview
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paid join</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Exact NEP-141 ft_transfer_call. Paid membership is not voting weight.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading group…</p>
        ) : error || !group ? (
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="font-medium">Group not found</p>
              <p className="text-xs text-muted-foreground">
                {error ?? `No group with ID ${raw}.`}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/join">Enter a group ID</Link>
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
                      {group.description || "No description"}
                    </p>
                  </div>
                  <Badge variant={group.dao_id ? "default" : "secondary"}>
                    {group.dao_id ? "DAO" : "Group"}
                  </Badge>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  group #{group.id} · fee {group.join_fee}
                </p>
              </CardContent>
            </Card>
            <GroupJoinCard groupId={groupId} />
            <PrivacyNotice compact />
            <Button asChild variant="outline" className="w-full">
              <Link href={`/groups/${groupId}`}>Continue to overview</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
