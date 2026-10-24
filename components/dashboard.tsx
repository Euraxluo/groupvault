"use client"

import { useEffect, useState } from "react"
import { ArrowRight, MessageSquareText, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getNearConfig } from "@/lib/near/config"
import { createGroupVaultClient, type GroupView } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"
import { useNearSession } from "@/hooks/use-near-session"

export function Dashboard() {
  const session = useNearSession()
  const [groups, setGroups] = useState<GroupView[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("Contract not configured yet. This build shows no invented groups.")
      return
    }
    const client = createGroupVaultClient(
      session.selector,
      new NearRpc(config),
      config.groupVaultContractId,
    )
    client
      .getGroups(0, 20)
      .then(setGroups)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      )
  }, [session])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your groups</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Discovery reads the bounded on-chain group list.
          </p>
        </div>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/groups/new">
            New group
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none bg-primary/5 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{groups.length}</p>
              <p className="text-[11px] text-muted-foreground">Known groups</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none bg-emerald-500/5 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-lg font-bold">Wallet</p>
              <p className="text-[11px] text-muted-foreground">Only signer</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}

      {!error && groups.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base">No groups yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Create the first paid group, then invite a second wallet to join.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/groups/new">Create a group</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {groups.map((group) => (
          <Link key={group.id} href={`/groups/${group.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="p-4 pb-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">{group.name}</CardTitle>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {group.member_count} members · {group.join_fee} base units
                    </p>
                  </div>
                  <Badge variant={group.dao_id ? "default" : "secondary"}>
                    {group.convert_pending
                      ? "Converting"
                      : group.dao_id
                        ? "DAO"
                        : "Group"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between p-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Public chat logs
                </span>
                <span className="flex items-center gap-1 text-primary">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
