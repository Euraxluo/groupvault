"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateGroup } from "@/hooks/use-group-vault"
import { getNearConfig } from "@/lib/near/config"
import { CREATE_GROUP_DEPOSIT } from "@/lib/near/deposits"
import { parseFtToBaseUnits } from "@/lib/near/format"

export interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const router = useRouter()
  const config = getNearConfig()
  const { create, submitting, error } = useCreateGroup()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [joinFee, setJoinFee] = useState("1")
  const [members, setMembers] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async () => {
    setLocalError(null)
    if (!name.trim()) {
      setLocalError("请填写群名")
      return
    }
    let joinFeeBaseUnits: string
    try {
      joinFeeBaseUnits = parseFtToBaseUnits(joinFee, 6)
    } catch {
      setLocalError("入群费格式不对：最多 6 位小数，不能为负")
      return
    }
    if (!config.joinFtContractId) {
      setLocalError("入群币合约尚未配置")
      return
    }
    const initialMembers = members
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    try {
      const receipt = await create(
        {
          name: name.trim(),
          description: description.trim(),
          joinFee: joinFeeBaseUnits,
          joinFt: config.joinFtContractId,
          initialMembers,
        },
        CREATE_GROUP_DEPOSIT,
      )
      if (receipt.groupId === null) {
        setLocalError("群已创建，但链上暂时读不到群号。请稍后刷新重试。")
        return
      }
      onOpenChange(false)
      router.push(`/groups/${receipt.groupId}/chat`)
    } catch (reason) {
      // Hook may not have set error if the throw happened before its try.
      setLocalError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建付费群</DialogTitle>
          <DialogDescription>
            钱包签一次名即可建群。升级为 DAO 是之后群主单独发起的操作。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">群名</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="比如：产品讨论群"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-description">群简介</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="这个群聊什么？"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-fee">入群费（入群币）</Label>
            <Input
              id="join-fee"
              inputMode="decimal"
              value={joinFee}
              onChange={(event) => setJoinFee(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              使用 6 位小数的入群币计价，例如 1 或 0.25。付费进群不产生投票权重。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial-members">初始成员账户（可选）</Label>
            <Textarea
              id="initial-members"
              value={members}
              onChange={(event) => setMembers(event.target.value)}
              placeholder="alice.testnet, bob.testnet"
            />
          </div>
        </div>

        {error || localError ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {localError ?? error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "等待钱包…" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
