"use client"

import { useState } from "react"
import Link from "next/link"
import { RefreshCw, Send, Users, Wallet } from "lucide-react"

import { PrivacyNotice } from "@/components/privacy-notice"
import { UnifiedChatMessage } from "@/components/unified-chat-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useGroupMessages } from "@/hooks/use-group-messages"
import { useGroupVault } from "@/hooks/use-group-vault"
import { useNearWallet } from "@/hooks/use-near-wallet"

const MAX_BYTES = 4096

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length
}

export function GroupChat({
  groupId,
  onOpenGroup,
}: {
  groupId: number
  onOpenGroup?: () => void
}) {
  const wallet = useNearWallet()
  const { group, members, loading, error: groupError, refresh: refreshGroup } =
    useGroupVault(groupId)
  const { messages, loading: messagesLoading, indexing, error, refresh, send, sending } =
    useGroupMessages(groupId)
  const [text, setText] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const isMember = Boolean(wallet.accountId && members.includes(wallet.accountId))
  const bytes = utf8Bytes(text)
  // Membership arrives with the group read. Until it does, do not tell a real
  // member to pay again, and do not offer a composer we cannot back with chain
  // state.
  const membershipPending = loading && members.length === 0

  const submit = async () => {
    setLocalError(null)
    if (!text.trim()) {
      setLocalError("消息不能为空")
      return
    }
    if (bytes > MAX_BYTES) {
      setLocalError(`消息为 ${bytes} 字节，上限 ${MAX_BYTES} 字节`)
      return
    }
    try {
      await send(text)
      setText("")
    } catch {
      // The hook already exposes the wallet/RPC error.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {group ? group.name : loading ? "正在读取群…" : "群聊"}
            </h1>
            {group?.dao_id ? <Badge className="shrink-0">DAO</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {group
              ? `${group.member_count} 位成员 · 公开链上聊天`
              : groupError
                ? "群信息暂不可用"
                : "正在读取群信息…"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 min-h-10 px-2.5"
            onClick={() => {
              void refresh()
              void refreshGroup()
            }}
            disabled={messagesLoading}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">刷新</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 min-h-10 rounded-full px-4"
            onClick={onOpenGroup}
            disabled={!group}
          >
            <Users className="mr-1.5 h-4 w-4" />
            群
          </Button>
        </div>
      </div>

      <PrivacyNotice compact />

      {groupError ? (
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            {/Failed to fetch|fetch failed|NetworkError|429|Rate limit|RPC/i.test(
              groupError,
            )
              ? "网络繁忙"
              : "群信息读取失败"}
          </p>
          <p className="break-words text-xs text-muted-foreground">{groupError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refreshGroup()}>
            重试
          </Button>
        </div>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="min-h-[16rem] space-y-4 p-4">
          {messagesLoading && messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              正在读取消息…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {indexing
                ? "正在等待索引器同步，新消息可能稍后出现。"
                : "还没有消息。发出第一条链上公开消息吧。"}
            </p>
          ) : (
            messages.map((message) => (
              <UnifiedChatMessage
                key={`${message.receipt_id}:${message.log_index}`}
                message={message}
              />
            ))
          )}
        </CardContent>
      </Card>

      {indexing ? (
        <p className="text-center text-[11px] text-muted-foreground">
          索引器同步中，消息可能延迟显示…
        </p>
      ) : null}

      {!wallet.accountId ? (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">连接钱包后聊天</p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            成员用钱包签名发布公开链上消息。先连接 testnet 钱包或 Keypair (demo)。
          </p>
          <Button
            id="btn-chat-connect"
            className="h-11 min-h-11 w-full rounded-xl"
            onClick={() => document.getElementById("btn-nav-wallet")?.click()}
          >
            <Wallet className="mr-2 h-4 w-4" />
            连接钱包
          </Button>
        </div>
      ) : membershipPending ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          正在确认你的成员身份…
        </p>
      ) : isMember ? (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写一条公开消息…"
            rows={3}
            className="min-h-[5.5rem] text-base"
          />
          <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span>
              {bytes} / {MAX_BYTES} 字节
            </span>
            <Button
              className="h-11 min-h-11 rounded-xl px-5"
              onClick={submit}
              disabled={sending || bytes > MAX_BYTES}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? "发送中…" : "发送"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-dashed p-4">
          <p className="text-sm font-medium">付费进群后才能发言</p>
          <p className="text-[13px] text-muted-foreground">
            目前只有成员可以发布消息。先在群页面支付入群币。
          </p>
          <Button asChild className="h-11 min-h-11 w-full rounded-xl">
            <Link href={`/groups/${groupId}/join`}>付费进群</Link>
          </Button>
        </div>
      )}

      {localError || error ? (
        <p className="text-sm text-destructive">{localError ?? error}</p>
      ) : null}
    </div>
  )
}
