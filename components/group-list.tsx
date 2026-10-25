"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Users } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNearSession } from "@/hooks/use-near-session"
import { getNearConfig } from "@/lib/near/config"
import { createGroupVaultClient, type GroupView } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"

export function GroupList() {
  const session = useNearSession()
  const [groups, setGroups] = useState<GroupView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const config = getNearConfig()
    if (!config.groupVaultContractId) {
      setError("Contract not configured yet.")
      setLoading(false)
      return
    }
    if (!session) {
      // Wallet selector boots async; keep the loading copy until it is ready.
      return
    }
    let cancelled = false
    createGroupVaultClient(session.selector, new NearRpc(config), config.groupVaultContractId)
      .getGroups(0, 50)
      .then((next) => {
        if (!cancelled) setGroups(next)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  if (loading) return <p className="text-sm text-muted-foreground">Reading groups…</p>
  if (error)
    return (
      <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
        {error}
      </p>
    )
  if (groups.length === 0)
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No groups on this contract yet.
        </CardContent>
      </Card>
    )

  return (
    <div className="grid gap-3">
      {groups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="p-4 pb-1">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm">{group.name}</CardTitle>
                <Badge variant={group.dao_id ? "default" : "secondary"}>
                  {group.dao_id ? "DAO" : group.convert_pending ? "Converting" : "Group"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2 p-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {group.member_count} members · fee {group.join_fee}
              </span>
              <span className="flex items-center gap-1 text-primary">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
