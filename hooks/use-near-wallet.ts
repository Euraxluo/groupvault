"use client"

import { useCallback, useEffect, useState } from "react"

import {
  connectWallet,
  createNearWalletSelector,
  disconnectWallet,
  getConnectedAccountId,
  type NearSession,
} from "@/lib/near/selector"

export interface NearWalletState {
  ready: boolean
  accountId: string | null
  error: string | null
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Session refresh is delegated to the wallet selector's own persisted state.
 * A reload restores the wallet session; no app-level key copy exists.
 */
export function useNearWallet(): NearWalletState {
  const [session, setSession] = useState<NearSession | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    createNearWalletSelector()
      .then((next) => {
        if (cancelled) return
        setSession(next)
        setAccountId(getConnectedAccountId(next.selector))
        setReady(true)
        const subscription = next.selector.store.observable.subscribe(() => {
          setAccountId(getConnectedAccountId(next.selector))
        })
        unsubscribe = () => subscription.unsubscribe()
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setReady(true)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const next = await connectWallet()
      setAccountId(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await disconnectWallet()
    setAccountId(null)
  }, [])

  return { ready, accountId, error, connecting, connect, disconnect }
}

export function useNearSession(): NearSession | null {
  const [session, setSession] = useState<NearSession | null>(null)
  useEffect(() => {
    let cancelled = false
    createNearWalletSelector().then((next) => {
      if (!cancelled) setSession(next)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return session
}
