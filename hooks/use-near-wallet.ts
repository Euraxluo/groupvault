"use client"

import { useCallback, useEffect, useState } from "react"

import {
  connectWallet,
  connectWithKeypair,
  createNearWalletSelector,
  disconnectWallet,
  getConnectedAccountId,
  type NearSession,
} from "@/lib/near/selector"
import {
  hydrateDemoKeypairFromRuntime,
  subscribeDemoKeypair,
  type DemoKeypairCredentials,
} from "@/lib/near/keypair-session"

export interface NearWalletState {
  ready: boolean
  accountId: string | null
  error: string | null
  connecting: boolean
  /** True when the active session is the demo keypair signer. */
  keypairMode: boolean
  connect: () => Promise<void>
  connectKeypair: (credentials: DemoKeypairCredentials) => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Session refresh is delegated to the wallet selector's own persisted state,
 * plus an optional demo keypair overlay (sessionStorage / window injection).
 */
export function useNearWallet(): NearWalletState {
  const [session, setSession] = useState<NearSession | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [keypairMode, setKeypairMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshAccount = useCallback((next: NearSession | null) => {
    const demo = hydrateDemoKeypairFromRuntime()
    setKeypairMode(Boolean(demo))
    if (demo) {
      setAccountId(demo.accountId)
      return
    }
    if (next) {
      setAccountId(getConnectedAccountId(next.selector))
    } else {
      setAccountId(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    createNearWalletSelector()
      .then((next) => {
        if (cancelled) return
        setSession(next)
        refreshAccount(next)
        setReady(true)
        const subscription = next.selector.store.observable.subscribe(() => {
          refreshAccount(next)
        })
        unsubscribe = () => subscription.unsubscribe()
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setReady(true)
      })

    const unsubDemo = subscribeDemoKeypair(() => {
      // session may already be set; refresh overlay
      setSession((current) => {
        refreshAccount(current)
        return current
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
      unsubDemo()
    }
  }, [refreshAccount])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const next = await connectWallet()
      setAccountId(next)
      setKeypairMode(Boolean(hydrateDemoKeypairFromRuntime()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setConnecting(false)
    }
  }, [])

  const connectKeypair = useCallback(async (credentials: DemoKeypairCredentials) => {
    setConnecting(true)
    setError(null)
    try {
      const next = await connectWithKeypair(credentials)
      setAccountId(next)
      setKeypairMode(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      throw reason
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await disconnectWallet()
    setAccountId(null)
    setKeypairMode(false)
  }, [])

  return {
    ready,
    accountId,
    error,
    connecting,
    keypairMode,
    connect,
    connectKeypair,
    disconnect,
  }
}

export function useNearSession(): NearSession | null {
  const [session, setSession] = useState<NearSession | null>(null)
  useEffect(() => {
    let cancelled = false
    createNearWalletSelector()
      .then((next) => {
        if (!cancelled) setSession(next)
      })
      .catch((reason: unknown) => {
        // Configuration or wallet availability errors are surfaced by the
        // wallet hook; this hook must not throw during render.
        console.warn("[GroupVault] NEAR session unavailable", reason)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return session
}
