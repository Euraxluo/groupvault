"use client"

import { useState } from "react"
import Link from "next/link"
import { RefreshCw, Send, Wallet } from "lucide-react"

import { PrivacyNotice } from "@/components/privacy-notice"
import { UnifiedChatMessage } from "@/components/unified-chat-message"
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

export function GroupChat({ groupId }: { groupId: number }) {
  const wallet = useNearWallet()
  const { group, members } = useGroupVault(groupId)
  const { messages, loading, indexing, error, refresh, send, sending } =
    useGroupMessages(groupId)
  const [text, setText] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const isMember = Boolean(wallet.accountId && members.includes(wallet.accountId))
  const bytes = utf8Bytes(text)

  const submit = async () => {
    setLocalError(null)
    if (!text.trim()) {
      setLocalError("Message cannot be empty")
      return
    }
    if (bytes > MAX_BYTES) {
      setLocalError(`Message is ${bytes} bytes; the limit is ${MAX_BYTES}`)
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
      <PrivacyNotice compact />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">Public chat</h2>
          <p className="truncate text-sm text-muted-foreground">
            {group
              ? `${group.name} · ${group.member_count} members`
              : loading
                ? "Loading group…"
                : "Group unavailable"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 min-h-10 shrink-0"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {indexing ? "Indexing…" : "Refresh"}
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="min-h-[14rem] space-y-4 p-4">
          {loading && messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading messages…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet, or the indexer is still syncing.
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

      {!wallet.accountId ? (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Connect to chat</p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Members sign public on-chain messages. Connect a testnet wallet or
            Keypair (demo) first.
          </p>
          <Button
            id="btn-chat-connect"
            className="h-11 min-h-11 w-full rounded-xl"
            onClick={() =>
              document.getElementById("btn-nav-wallet")?.click()
            }
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect wallet
          </Button>
        </div>
      ) : isMember ? (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a public message…"
            rows={3}
            className="min-h-[5.5rem] text-base"
          />
          <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span>
              {bytes} / {MAX_BYTES} bytes
            </span>
            <Button
              className="h-11 min-h-11 rounded-xl px-5"
              onClick={submit}
              disabled={sending || bytes > MAX_BYTES}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-dashed p-4">
          <p className="text-sm font-medium">Join to send</p>
          <p className="text-[13px] text-muted-foreground">
            Only members can post. Pay the join FT on the group wall.
          </p>
          <Button asChild className="h-11 min-h-11 w-full rounded-xl">
            <Link href={`/groups/${groupId}/join`}>Pay and join</Link>
          </Button>
        </div>
      )}

      {localError || error ? (
        <p className="text-sm text-destructive">{localError ?? error}</p>
      ) : null}
    </div>
  )
}
