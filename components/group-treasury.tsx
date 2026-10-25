"use client"

import { useState } from "react"
import { Coins, Loader2, Vote } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDao } from "@/hooks/use-dao"
import { useVotes } from "@/hooks/use-votes"
import { fundDao } from "@/lib/near/treasury"
import { useNearSession } from "@/hooks/use-near-session"
import type { Proposal } from "@/lib/near/sputnik"

export function GroupTreasury({ daoId }: { daoId: string }) {
  const session = useNearSession()
  const dao = useDao(daoId)
  const votes = useVotes(daoId, [])
  const [receiver, setReceiver] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState<"fund" | "propose" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fund = async () => {
    if (!session || !dao.accountId || !/^\d+$/.test(amount)) return
    setBusy("fund")
    setError(null)
    try {
      await fundDao(session.selector, dao.accountId, daoId, amount)
      await dao.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  const propose = async () => {
    setBusy("propose")
    setError(null)
    try {
      await votes.addTransfer({ receiverId: receiver, amount, description })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="h-4 w-4" /> Treasury
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="text-xs text-muted-foreground">
            Native Transfer uses token_id=&quot;&quot; and msg=null. The proposal
            bond must equal get_policy().proposal_bond.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="fund-amount">Fund amount (yoctoNEAR)</Label>
            <Input
              id="fund-amount"
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1000000000000000000000000"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy !== null || !dao.accountId || !/^\d+$/.test(amount)}
            onClick={() => void fund()}
          >
            {busy === "fund" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fund DAO from wallet
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Vote className="h-4 w-4" /> Add native Transfer proposal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <Input
            placeholder="receiver.testnet"
            value={receiver}
            onChange={(event) => setReceiver(event.target.value)}
          />
          <Input
            placeholder="amount in yoctoNEAR"
            value={amount}
            inputMode="numeric"
            onChange={(event) => setAmount(event.target.value)}
          />
          <Input
            placeholder="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={
              busy !== null ||
              !dao.accountId ||
              !receiver.trim() ||
              !description.trim() ||
              !/^\d+$/.test(amount)
            }
            onClick={() => void propose()}
          >
            {busy === "propose" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Transfer proposal
          </Button>
          {votes.lastAddedId !== null ? (
            <p className="text-[11px] text-muted-foreground">
              Proposal{" "}
              <a
                className="font-mono underline"
                href={`/dao/${daoId}/proposals/${votes.lastAddedId}`}
              >
                #{votes.lastAddedId}
              </a>{" "}
              created. Open it to approve.
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Approval automatically schedules execution at threshold. There is no
            extra execute signature.
          </p>
        </CardContent>
      </Card>

      {votes.error || error ? (
        <p className="text-xs text-destructive">{error ?? votes.error}</p>
      ) : null}
    </div>
  )
}

export function ProposalList({
  daoId,
  proposals,
  onApprove,
}: {
  daoId: string
  proposals: Proposal[]
  onApprove: (proposal: Proposal) => Promise<void>
}) {
  return (
    <div className="space-y-2">
      {proposals.map((proposal) => (
        <Card key={proposal.id} className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                #{proposal.id} · {proposal.description}
              </p>
              <Badge variant="outline">{proposal.status}</Badge>
            </div>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px]">
              {JSON.stringify(proposal.kind, null, 2)}
            </pre>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => void onApprove(proposal)}>
                Approve exact kind
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/dao/${daoId}/proposals/${proposal.id}`}>Details</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
