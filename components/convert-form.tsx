"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useConvert } from "@/hooks/use-convert"
import { CONVERT_DEPOSIT } from "@/lib/near/deposits"

export function ConvertForm({
  groupId,
  groupIdText = String(groupId),
}: {
  groupId: number
  groupIdText?: string
}) {
  const convert = useConvert(groupId)
  const [daoName, setDaoName] = useState("")
  const [purpose, setPurpose] = useState("Paid group converting to a DAO")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (convert.group && !convert.group.dao_id && daoName === "") {
      setDaoName(`groupvault-${convert.group.id}`)
    }
  }, [convert.group, daoName])

  const submit = async () => {
    setLocalError(null)
    if (!/^[a-z0-9_-]{1,32}$/.test(daoName)) {
      setLocalError("DAO name must be 1-32 lowercase letters, digits, - or _")
      return
    }
    try {
      await convert.submit(daoName, purpose)
    } catch {
      // The hook surfaces the actual wallet/RPC failure.
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link href={`/groups/${groupIdText}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Group
          </Link>
        </Button>

        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Convert to DAO</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              One owner signature. GroupVault calls Sputnik factory.create.
            </p>
          </div>
          <KeyRound className="h-6 w-6 text-primary" />
        </div>

        <Card className="mb-4 border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="space-y-2 p-4 text-xs">
            <p className="font-medium">This is not a threshold ceremony.</p>
            <p className="text-muted-foreground">
              One owner signature creates the DAO. No key ceremony or key
              resharing is involved; the current members become the initial
              Sputnik council snapshot (up to 50).
            </p>
            <Badge variant="outline" className="font-mono">
              deposit {CONVERT_DEPOSIT} yoctoNEAR
            </Badge>
          </CardContent>
        </Card>

        {convert.group?.dao_id ? (
          <Card className="mb-4 border-emerald-300 bg-emerald-50 shadow-none">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Converted
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs">
              <p className="break-all font-mono">{convert.group.dao_id}</p>
              <Button asChild size="sm" className="mt-3">
                <Link href={`/dao/${convert.group.dao_id}`}>Open DAO setup</Link>
              </Button>
            </CardContent>
          </Card>
        ) : convert.pending ? (
          <Card className="mb-4 border-amber-300 bg-amber-50 shadow-none">
            <CardContent className="p-4 text-xs">
              <p className="font-medium">Conversion pending</p>
              <p className="mt-1 text-muted-foreground">
                Wait for the factory callback. dao_id is written only if the
                factory returns true.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void convert.refresh()}
              >
                Refresh final state
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!convert.group?.dao_id ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Owner inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dao-name">DAO name</Label>
                <Input
                  id="dao-name"
                  value={daoName}
                  onChange={(event) => setDaoName(event.target.value)}
                  placeholder="builders"
                />
                <p className="text-[11px] text-muted-foreground">
                  The factory appends its own suffix; enter only the unqualified
                  prefix.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </div>
              {convert.reason ? (
                <div className="space-y-2 rounded-lg bg-muted p-3">
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {convert.reason}
                  </p>
                  {!convert.group ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10 min-h-10 w-full rounded-xl"
                      onClick={() => void convert.refresh()}
                    >
                      Retry load
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {localError || convert.error ? (
                <p className="text-xs text-destructive">
                  {localError ?? convert.error}
                </p>
              ) : null}
              <Button
                className="h-12 min-h-12 w-full rounded-xl text-base"
                disabled={!convert.canConvert || convert.submitting}
                onClick={submit}
              >
                {convert.submitting ? "Waiting for wallet…" : "Convert with wallet"}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
