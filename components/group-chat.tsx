"use client"

import { useState } from "react"
import { RefreshCw, Send } from "lucide-react"

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
      <PrivacyNotice />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Public chat</h2>
          <p className="text-[11px] text-muted-foreground">
            {group ? `${group.name} · ${group.member_count} members` : "Loading group…"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {indexing ? "Indexing…" : "Refresh"}
        </Button>
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
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

      {isMember ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a public message…"
            rows={3}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{bytes} / {MAX_BYTES} bytes</span>
            <Button size="sm" onClick={submit} disabled={sending || bytes > MAX_BYTES}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sending ? "Waiting for wallet…" : "Send"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Only members can send messages. Join this group from its overview page.
        </p>
      )}

      {localError || error ? (
        <p className="text-xs text-destructive">{localError ?? error}</p>
      ) : null}
    </div>
  )
}
