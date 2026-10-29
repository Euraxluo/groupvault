"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, Loader2, RotateCw } from "lucide-react"

import type { Proposal } from "@/lib/near/sputnik"
import { MobileNavbar } from "@/components/mobile-navbar"
import { ProposalList } from "@/components/group-treasury"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useNearSession } from "@/hooks/use-near-session"
import { useVotes } from "@/hooks/use-votes"
import { getNearConfig } from "@/lib/near/config"
import { createSputnikClient } from "@/lib/near/sputnik"
import { NearRpc } from "@/lib/near/rpc"

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
  const session = useNearSession()
  const [ids, setIds] = useState<number[]>(requested)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [candidate, setCandidate] = useState("")
  const [manualId, setManualId] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Approval still goes through the existing weight-gated hook; this page owns
  // only the bounded proposal reads.
  const votes = useVotes(daoId, [])

  useEffect(() => {
    const explicit = parseIds(queryValue)
    if (explicit.length > 0) {
      setIds(explicit)
    }
  }, [queryValue])

  const load = useCallback(
    async (signal: { cancelled: boolean }) => {
      if (!session) return
      const config = getNearConfig()
      if (!config.groupVaultContractId) {
        setReadError("群合约尚未配置")
        setLoading(false)
        return
      }
      setLoading(true)
      setReadError(null)
      const client = createSputnikClient(session.selector, new NearRpc(config))
      try {
        const linkIds = manualId === null ? parseIds(queryValue) : [manualId]
        let nextIds = linkIds
        if (nextIds.length === 0) {
          const newest = await client.getNewestProposalId(daoId)
          if (signal.cancelled) return
          nextIds =
            newest < 0
              ? []
              : Array.from(
                  { length: Math.min(newest + 1, LOOKBACK) },
                  (_, index) => newest - index,
                )
        }
        // Bounded concurrency: the public testnet RPC 429s a 10-wide burst and
        // one failure used to discard every successfully read proposal.
        const loaded: Proposal[] = []
        let failed = 0
        let failure: unknown = null
        let cursor = 0
        const worker = async () => {
          while (cursor < nextIds.length && !signal.cancelled) {
            const id = nextIds[cursor]!
            cursor += 1
            try {
              const proposal = await client.getProposal(daoId, id)
              if (signal.cancelled) return
              if (proposal) loaded.push(proposal)
              else failed += 1
            } catch (reason) {
              failed += 1
              failure = reason
            }
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(3, nextIds.length) }, () => worker()),
        )
        if (signal.cancelled) return
        loaded.sort((left, right) => right.id - left.id)
        setIds(nextIds)
        setProposals(loaded)
        if (failed > 0) {
          const message =
            failure instanceof Error ? failure.message : String(failure)
          setReadError(
            loaded.length === 0
              ? message
              : `${failed} 个提案读取失败，已显示其余 ${loaded.length} 个：${message}`,
          )
        }
      } catch (reason) {
        if (signal.cancelled) return
        setProposals([])
        setReadError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        if (!signal.cancelled) setLoading(false)
      }
    },
    [session, daoId, queryValue, manualId],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, attempt])

  const empty = !loading && !readError && ids.length === 0

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
              setManualId(id)
              setCandidate("")
            }}
          >
            加载
          </Button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取链上提案…
          </p>
        ) : null}

        {readError ? (
          <Card className="border-destructive/30 shadow-none">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium text-destructive">提案读取失败</p>
              <p className="break-words text-xs text-muted-foreground">
                {readError}
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

        {votes.error ? (
          <p className="break-words text-xs text-destructive">{votes.error}</p>
        ) : null}

        <ProposalList
          daoId={daoId}
          proposals={proposals}
          onApprove={async (proposal) => {
            await votes.approve(proposal)
            // Re-read the bounded window so the badge reflects chain status.
            setAttempt((value) => value + 1)
          }}
        />
      </div>
    </main>
  )
}
