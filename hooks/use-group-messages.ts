"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getNearConfig } from "@/lib/near/config"
import { getIndexerHealth, getMessages, type ChatMessage } from "@/lib/near/indexer"
import { createGroupVaultClient } from "@/lib/near/groupvault"
import { NearRpc } from "@/lib/near/rpc"
import { useNearSession } from "@/hooks/use-near-session"

export interface GroupMessagesState {
  messages: ChatMessage[]
  loading: boolean
  indexing: boolean
  error: string | null
  refresh: () => Promise<void>
  send: (text: string) => Promise<void>
  sending: boolean
}

/**
 * Messages only appear after the chain accepted them and the indexer saw them.
 * The UI never inserts an optimistic message as confirmed content.
 */
export function useGroupMessages(groupId: number): GroupMessagesState {
  const session = useNearSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [indexing, setIndexing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursor = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const config = getNearConfig()
    try {
      const health = await getIndexerHealth(config.indexerUrl)
      setIndexing(!health.ready || health.error !== null)
      const page = await getMessages(config.indexerUrl, groupId)
      setMessages(page.items)
      cursor.current = page.next_cursor
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const send = useCallback(
    async (text: string) => {
      if (!session) throw new Error("Wallet session is not ready")
      const accountId = session.selector.store
        .getState()
        .accounts.find((account) => account.active)?.accountId
      if (!accountId) throw new Error("Connect a wallet before sending")
      const config = getNearConfig()
      const client = createGroupVaultClient(
        session.selector,
        new NearRpc(config),
        config.groupVaultContractId,
      )
      setSending(true)
      setError(null)
      try {
        await client.sendMessage(accountId, groupId, text)
        await refresh()
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason)
        setError(message)
        throw reason
      } finally {
        setSending(false)
      }
    },
    [session, groupId, refresh],
  )

  return { messages, loading, indexing, error, refresh, send, sending }
}
