"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, Loader2, RotateCw } from "lucide-react"

import { MobileNavbar } from "@/components/mobile-navbar"
import { ProposalList } from "@/components/group-treasury"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useDao } from "@/hooks/use-dao"
import { useVotes } from "@/hooks/use-votes"

const LOOKBACK = 10

function parseIds(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => Number(item))
        .filter((item) => Number.isSafeInteger(item) && item >= 0),
    ),
  )
}

export default function ProposalsPage({
  params,
}: {
  params: Promise<{ daoId: string }>
}) {
  const { daoId } = use(params)
  const searchParams = useSearchParams()
  const queryValue = searchParams.get("ids") ?? ""
  const requested = parseIds(queryValue)
  const dao = useDao(daoId)
  const [ids, setIds] = useState<number[]>(requested)
  const [candidate, setCandidate] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [scan, setScan] = useState<{
    loading: boolean
    done: boolean
    error: string | null
  }>({ loading: true, done: false, error: null })
  const votes = useVotes(daoId, ids)

  useEffect(() => {
    const explicit = parseIds(queryValue)
    if (explicit.length > 0) {
      setIds(explicit)
      setScan({ loading: false, done: true, error: null })
      return
    }
    const sputnik = dao.sputnik
    if (!sputnik) return

    let cancelled = false
    setScan({ loading: true, done: false, error: null })
    void (async () => {
      try {
        const newest = await sputnik.getNewestProposalId(daoId)
        if (cancelled) return
        if (newest < 0) {
          setIds([])
        } else {
          const start = Math.max(0, newest - LOOKBACK + 1)
          setIds(
            Array.from({ length: newest - start + 1 }, (_, index) => newest - index),
          )
        }
        setScan({ loading: false, done: true, error: null })
      } catch (reason) {
        if (cancelled) return
        setIds([])
        setScan({
          loading: false,
          done: true,
          error: reason instanceof Error ? reason.message : String(reason),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dao.sputnik, daoId, queryValue, attempt])

  const scanFailed = Boolean(scan.error)
  const empty = scan.done && !scanFailed && ids.length === 0
  const listLoading =
    scan.loading || (ids.length > 0 && votes.loading && votes.proposals.length === 0)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 pb-28 pt-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">提案</h1>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {daoId}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          批准会提交 act_proposal(VoteApprove) 与准确的提案类型。达到阈值后自动排队执行，不需要额外签名。
        </p>
        <p className="text-[11px] text-muted-foreground">
          {requested.length > 0
            ? `链接指定了 ${requested.length} 个提案。`
            : `链上最近 ${LOOKBACK} 个提案，按编号从新到旧。`}
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="提案编号"
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          />
          <Button
            disabled={!/^\d+$/.test(candidate)}
            onClick={() => {
              const id = Number(candidate)
              if (!ids.includes(id)) setIds([id, ...ids])
              setCandidate("")
            }}
          >
            加载
          </Button>
        </div>

        {listLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取链上提案…
          </p>
        ) : null}

        {scanFailed ? (
          <Card className="border-destructive/30 shadow-none">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium text-destructive">提案读取失败</p>
              <p className="break-words text-xs text-muted-foreground">
                {scan.error}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                重试
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {votes.error && !scanFailed ? (
          <p className="break-words text-xs text-destructive">{votes.error}</p>
        ) : null}

        {empty ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium">这个 DAO 还没有提案</p>
              <p className="text-xs text-muted-foreground">
                从金库发起第一笔转账提案；达到阈值后会自动执行。
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dao/${daoId}/treasury`}>
                  去金库发起转账
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!scanFailed ? (
          <ProposalList
            daoId={daoId}
            proposals={votes.proposals}
            onApprove={votes.approve}
          />
        ) : null}
      </div>
    </main>
  )
}
