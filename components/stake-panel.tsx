"use client"

import { useState } from "react"
import { Coins, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDao } from "@/hooks/use-dao"
import { useNearSession } from "@/hooks/use-near-session"
import { getNearConfig } from "@/lib/near/config"
import { getConnectedAccountId } from "@/lib/near/selector"

type Step = "deposit" | "transfer" | "delegate" | null

/**
 * Real stake / delegate flow against the DAO's SetStakingContract target.
 * Shows an honest blocked reason when staking is not configured.
 */
export function StakePanel({ daoId }: { daoId: string }) {
  const dao = useDao(daoId)
  const session = useNearSession()
  const config = getNearConfig()
  const [stakeAmount, setStakeAmount] = useState("")
  const [busy, setBusy] = useState<Step>(null)
  const [error, setError] = useState<string | null>(null)

  const requireWallet = () => {
    const accountId =
      (session ? getConnectedAccountId(session.selector) : null) ?? dao.accountId
    if (!accountId || !dao.staking) {
      throw new Error("Connect a wallet first")
    }
    return accountId
  }

  const run = async (step: Step, action: () => Promise<void>) => {
    setBusy(step)
    setError(null)
    try {
      await action()
      await dao.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  if (dao.loading) {
    return (
      <div className="space-y-2 rounded-xl border border-dashed p-4">
        <p className="text-sm text-muted-foreground">Loading DAO…</p>
        {dao.error ? (
          <>
            <p className="text-xs text-destructive">{dao.error}</p>
            <Button size="sm" variant="outline" className="h-10 min-h-10 w-full rounded-xl" onClick={() => void dao.refresh()}>
              Retry
            </Button>
          </>
        ) : null}
      </div>
    )
  }

  if (dao.error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-none">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-medium">Could not read DAO staking state</p>
          <p className="text-xs text-destructive">{dao.error}</p>
          <p className="text-[11px] text-muted-foreground">
            Usually RPC rate-limit or a missing wallet session. This is a load
            error — not proof that staking is unset.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-10 min-h-10 w-full rounded-xl"
            onClick={() => void dao.refresh()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!dao.accountId && !dao.stakingContract) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="space-y-3 p-4 text-sm">
          <p className="font-medium">Connect a wallet to load staking</p>
          <p className="text-xs text-muted-foreground">
            本应用的只读查询需要钱包会话。点击顶部钱包按钮，选择 MyNearWallet
            或演示密钥。
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!dao.stakingContract) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 shadow-none">
        <CardContent className="space-y-3 p-4 text-sm">
          <p className="font-medium">Staking is not set on this DAO</p>
          <p className="text-xs text-muted-foreground">
            The council must approve SetStakingContract before anyone can stake
            the join FT for TokenWeight.
          </p>
          <Button asChild size="sm">
            <Link href={`/dao/${daoId}/staking/setup`}>Open staking setup</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4" /> Stake the join FT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-xs text-muted-foreground">
          Staking contract{" "}
          <span className="break-all font-mono">{dao.stakingContract}</span>
          . Token{" "}
          <span className="break-all font-mono">{config.joinFtContractId}</span>.
          Paid join alone never creates weight.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="stake-amount">Stake amount (base units)</Label>
          <Input
            id="stake-amount"
            inputMode="numeric"
            className="h-11 min-h-11 text-base"
            value={stakeAmount}
            onChange={(event) => setStakeAmount(event.target.value)}
            placeholder="2000000"
          />
        </div>
        <div className="grid gap-2">
          <Button
            size="sm"
            className="h-11 min-h-11 w-full rounded-xl"
            variant="outline"
            disabled={busy !== null || !dao.accountId}
            onClick={() =>
              void run("deposit", async () => {
                const accountId = requireWallet()
                await dao.staking!.storageDeposit(
                  accountId,
                  dao.stakingContract!,
                  accountId,
                )
              })
            }
          >
            {busy === "deposit" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Storage deposit
          </Button>
          <Button
            size="sm"
            className="h-11 min-h-11 w-full rounded-xl"
            variant="outline"
            disabled={
              busy !== null || !dao.accountId || !/^\d+$/.test(stakeAmount)
            }
            onClick={() =>
              void run("transfer", async () => {
                const accountId = requireWallet()
                await dao.staking!.depositStake(
                  accountId,
                  config.joinFtContractId,
                  dao.stakingContract!,
                  stakeAmount,
                )
              })
            }
          >
            {busy === "transfer" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            FT transfer (msg=&quot;&quot;)
          </Button>
          <Button
            size="sm"
            className="h-11 min-h-11 w-full rounded-xl"
            disabled={
              busy !== null || !dao.accountId || !/^\d+$/.test(stakeAmount)
            }
            onClick={() =>
              void run("delegate", async () => {
                const accountId = requireWallet()
                await dao.staking!.delegate(
                  accountId,
                  dao.stakingContract!,
                  accountId,
                  stakeAmount,
                )
              })
            }
          >
            {busy === "delegate" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Delegate
          </Button>
        </div>
        {!dao.accountId ? (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            Connect via the wallet chip above, then run Storage → FT transfer →
            Delegate.
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Current delegation:{" "}
          <span className="font-mono">{dao.delegation}</span>
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
