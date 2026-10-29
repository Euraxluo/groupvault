"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LogOut, QrCode, RefreshCw, Wallet } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { getNearConfig } from "@/lib/near/config"
import { formatNearAmount } from "@/lib/near/format"
import { NearRpc } from "@/lib/near/rpc"

interface BalanceState {
  loading: boolean
  value: bigint | null
  error: string | null
}

export default function MePage() {
  const wallet = useNearWallet()
  const config = useMemo(() => getNearConfig(), [])
  const [balance, setBalance] = useState<BalanceState>({
    loading: false,
    value: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!wallet.accountId) {
      setBalance({ loading: false, value: null, error: null })
      return
    }
    let cancelled = false
    setBalance({ loading: true, value: null, error: null })
    new NearRpc(config)
      .accountBalance(wallet.accountId)
      .then((value) => {
        if (!cancelled) setBalance({ loading: false, value, error: null })
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setBalance({
            loading: false,
            value: null,
            error: reason instanceof Error ? reason.message : String(reason),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [wallet.accountId, config, attempt])

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">我的</h1>

        <Card className="shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              账户
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="flex items-center justify-between gap-3">
              <p className="break-all font-mono text-sm">
                {wallet.accountId ?? "未连接"}
              </p>
              <Badge variant="outline">{config.network}</Badge>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">可用余额</p>
              {!wallet.accountId ? (
                <p className="mt-1 text-sm text-muted-foreground">连接钱包后显示</p>
              ) : balance.loading ? (
                <p className="mt-1 text-sm text-muted-foreground">正在读取余额…</p>
              ) : balance.error ? (
                <div className="mt-1 space-y-1">
                  <p className="text-sm font-medium">余额暂不可用</p>
                  <p className="break-words text-[11px] text-muted-foreground">
                    {balance.error}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    重试
                  </Button>
                </div>
              ) : (
                <p className="mt-1 font-mono text-lg font-semibold">
                  {formatNearAmount(balance.value ?? 0n)} NEAR
                </p>
              )}
            </div>

            {wallet.error ? (
              <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                {wallet.error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="grid gap-2 p-4">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/me/qr">
                <QrCode className="mr-2 h-4 w-4" />
                我的二维码
              </Link>
            </Button>
            {wallet.accountId ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={wallet.connecting}
                onClick={() => void wallet.disconnect()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                断开钱包
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!wallet.ready || wallet.connecting}
                onClick={() => void wallet.connect()}
              >
                <Wallet className="mr-2 h-4 w-4" />
                {wallet.connecting ? "等待钱包…" : "连接钱包"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
