"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react"
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
import { formatNearAmount } from "@/lib/near/format"

export function ConvertForm({
  groupId,
  groupIdText = String(groupId),
}: {
  groupId: number
  groupIdText?: string
}) {
  const router = useRouter()
  const convert = useConvert(groupId)
  const [daoName, setDaoName] = useState("")
  const [purpose, setPurpose] = useState("付费群升级为 DAO")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (convert.group && !convert.group.dao_id && daoName === "") {
      setDaoName(`groupvault-${convert.group.id}`)
    }
  }, [convert.group, daoName])

  const submit = async () => {
    setLocalError(null)
    if (!/^[a-z0-9_-]{1,32}$/.test(daoName)) {
      setLocalError("DAO 名称只能包含 1–32 位小写字母、数字、- 或 _")
      return
    }
    let daoId: string
    try {
      daoId = await convert.submit(daoName, purpose)
    } catch {
      // The hook surfaces the actual wallet/RPC failure.
      return
    }
    router.push(
      `/dao/${encodeURIComponent(daoId)}/treasury?from=convert&groupId=${encodeURIComponent(groupIdText)}`,
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link href={`/groups/${groupIdText}/chat`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            回到群聊
          </Link>
        </Button>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">升级为 DAO</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              由群主一次签名完成，成员成为初始理事会。升级后群聊不变，额外获得金库与投票。
            </p>
          </div>
          <KeyRound className="h-6 w-6 shrink-0 text-primary" />
        </div>

        <Card className="mb-4 shadow-none">
          <CardContent className="space-y-2 p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">需要准备</span>
              <span className="font-semibold">
                约 {formatNearAmount(CONVERT_DEPOSIT)} NEAR
              </span>
            </div>
            <p className="text-muted-foreground">
              这包含创建 DAO 所需的押金与手续费。交易失败或余额不足时不会创建 DAO。
            </p>
            <Badge variant="outline">群主 1 签 · 无需多人或门限签名</Badge>
          </CardContent>
        </Card>

        {convert.group?.dao_id ? (
          <Card className="mb-4 border-emerald-300 bg-emerald-50 shadow-none">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                已是 DAO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-1 text-xs">
              <div>
                <p className="text-muted-foreground">DAO 地址</p>
                <p className="mt-0.5 break-all font-mono">{convert.group.dao_id}</p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link
                  href={`/dao/${convert.group.dao_id}/treasury?from=convert&groupId=${groupIdText}`}
                >
                  查看金库
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : convert.pending ? (
          <Card className="mb-4 border-amber-300 bg-amber-50 shadow-none">
            <CardContent className="p-4 text-xs">
              <p className="font-medium">升级确认中</p>
              <p className="mt-1 text-muted-foreground">
                等链上写入 DAO 地址后，页面才会跳转。不会用交易哈希猜一个 DAO。
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void convert.refresh()}
              >
                刷新链上状态
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!convert.group?.dao_id ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">确认升级</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dao-name">DAO 名称</Label>
                <Input
                  id="dao-name"
                  value={daoName}
                  onChange={(event) => setDaoName(event.target.value)}
                  placeholder="builders"
                />
                <p className="text-[11px] text-muted-foreground">
                  只填写前缀，系统会追加测试网后缀。
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purpose">用途说明</Label>
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
                      重试读取
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {localError || convert.error ? (
                <p className="break-words text-xs text-destructive">
                  {localError ?? convert.error}
                </p>
              ) : null}
              <Button
                className="h-12 min-h-12 w-full rounded-xl text-base"
                disabled={!convert.canConvert || convert.submitting || convert.pending}
                onClick={submit}
              >
                {convert.submitting ? "等待钱包签名…" : "确认升级"}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
