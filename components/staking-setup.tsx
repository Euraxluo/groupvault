"use client"

import { useState } from "react"
import { Coins, Loader2, ShieldCheck, Vote } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDao } from "@/hooks/use-dao"
import { getNearConfig } from "@/lib/near/config"
import {
  setStakingContractKind,
  tokenWeightPolicyUpdate,
} from "@/lib/near/sputnik"
import { TOKENWEIGHT_PROPOSAL_LABEL } from "@/lib/demo-flow"

type Step = "staking" | "tokenweight" | "deposit" | "transfer" | "delegate" | null

export function StakingSetup({ daoId }: { daoId: string }) {
  const dao = useDao(daoId)
  const config = getNearConfig()
  const [stakingId, setStakingId] = useState("")
  const [stakeAmount, setStakeAmount] = useState("")
  const [busy, setBusy] = useState<Step>(null)
  const [error, setError] = useState<string | null>(null)

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

  const requireCouncilWallet = () => {
    if (!dao.accountId || !dao.sputnik || !dao.policy) {
      throw new Error("Connect a council wallet first")
    }
    return dao.accountId
  }

  const propose = async (kind: Record<string, unknown>, description: string) => {
    const accountId = requireCouncilWallet()
    await dao.sputnik!.addProposal(
      accountId,
      daoId,
      { description, kind },
      dao.policy!.proposal_bond,
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4" /> 1. Set staking contract
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="text-xs text-muted-foreground">
            Proposal kind: SetStakingContract. Staking must already be deployed
            with owner_id=this DAO and token_id=the join FT.
          </p>
          <Input
            placeholder="staking account ID"
            value={stakingId}
            onChange={(event) => setStakingId(event.target.value)}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={busy !== null || !stakingId.includes(".") || !dao.accountId}
            onClick={() =>
              void run("staking", () =>
                propose(setStakingContractKind(stakingId), "Set GroupVault staking contract"),
              )
            }
          >
            {busy === "staking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add SetStakingContract proposal
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Current: <span className="font-mono">{dao.stakingContract ?? "not set"}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Vote className="h-4 w-4" /> 2. Enable TokenWeight
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="text-xs text-muted-foreground">
            {TOKENWEIGHT_PROPOSAL_LABEL}. SetStakingContract alone does not enable
            TokenWeight.
          </p>
          <Button
            size="sm"
            className="w-full"
            disabled={busy !== null || !dao.stakingContract || !dao.accountId}
            onClick={() =>
              void run("tokenweight", () =>
                propose(
                  tokenWeightPolicyUpdate(),
                  TOKENWEIGHT_PROPOSAL_LABEL,
                ),
              )
            }
          >
            {busy === "tokenweight" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Add TokenWeight policy proposal
          </Button>
          <Badge variant="outline">
            Current: {dao.policy?.default_vote_policy.weight_kind ?? "unknown"}
          </Badge>
        </CardContent>
      </Card>

      {dao.stakingContract ? (
        <Card className="shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4" /> 3. Stake the join FT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="stake-amount">Stake amount (base units)</Label>
              <Input
                id="stake-amount"
                inputMode="numeric"
                value={stakeAmount}
                onChange={(event) => setStakeAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !dao.accountId}
                onClick={() =>
                  void run("deposit", async () => {
                    const accountId = requireCouncilWallet()
                    await dao.staking!.storageDeposit(accountId, dao.stakingContract!, accountId)
                  })
                }
              >
                {busy === "deposit" ? "…" : "Storage deposit"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !dao.accountId || !/^\d+$/.test(stakeAmount)}
                onClick={() =>
                  void run("transfer", async () => {
                    const accountId = requireCouncilWallet()
                    await dao.staking!.depositStake(
                      accountId,
                      config.joinFtContractId,
                      dao.stakingContract!,
                      stakeAmount,
                    )
                  })
                }
              >
                {busy === "transfer" ? "…" : "FT transfer (msg=\"\")"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !dao.accountId || !/^\d+$/.test(stakeAmount)}
                onClick={() =>
                  void run("delegate", async () => {
                    const accountId = requireCouncilWallet()
                    await dao.staking!.delegate(
                      accountId,
                      dao.stakingContract!,
                      accountId,
                      stakeAmount,
                    )
                  })
                }
              >
                {busy === "delegate" ? "…" : "Delegate"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Current delegation: <span className="font-mono">{dao.delegation}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
