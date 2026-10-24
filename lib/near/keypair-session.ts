/**
 * Demo/hackathon keypair signer session (testnet only).
 *
 * Private keys come from runtime injection only:
 * - Playwright `window.__GV_KEYPAIR__ = { accountId, privateKey }`
 * - Connect dialog paste → sessionStorage for this tab
 * - Never hardcoded in source; never written to localStorage
 */

export interface DemoKeypairCredentials {
  accountId: string
  privateKey: string
}

export const DEMO_KEYPAIR_STORAGE_KEY = "gv.demo.keypair"
export const DEMO_KEYPAIR_WINDOW_KEY = "__GV_KEYPAIR__"

let memorySession: DemoKeypairCredentials | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeDemoKeypair(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

function readSessionStorage(): DemoKeypairCredentials | null {
  if (!isBrowser()) return null
  try {
    const raw = window.sessionStorage.getItem(DEMO_KEYPAIR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DemoKeypairCredentials>
    if (
      typeof parsed.accountId === "string" &&
      parsed.accountId.length > 0 &&
      typeof parsed.privateKey === "string" &&
      parsed.privateKey.length > 0
    ) {
      return { accountId: parsed.accountId, privateKey: parsed.privateKey }
    }
  } catch {
    // ignore corrupt storage
  }
  return null
}

function readWindowInjection(): DemoKeypairCredentials | null {
  if (!isBrowser()) return null
  const injected = (
    window as Window & {
      [DEMO_KEYPAIR_WINDOW_KEY]?: Partial<DemoKeypairCredentials>
    }
  )[DEMO_KEYPAIR_WINDOW_KEY]
  if (
    injected &&
    typeof injected.accountId === "string" &&
    injected.accountId.length > 0 &&
    typeof injected.privateKey === "string" &&
    injected.privateKey.length > 0
  ) {
    return { accountId: injected.accountId, privateKey: injected.privateKey }
  }
  return null
}

export function getDemoKeypairSession(): DemoKeypairCredentials | null {
  if (memorySession) return memorySession
  const fromWindow = readWindowInjection()
  if (fromWindow) {
    memorySession = fromWindow
    return memorySession
  }
  const fromStorage = readSessionStorage()
  if (fromStorage) {
    memorySession = fromStorage
    return memorySession
  }
  return null
}

export function isDemoKeypairActive(): boolean {
  return getDemoKeypairSession() !== null
}

export function setDemoKeypairSession(
  credentials: DemoKeypairCredentials,
  options: { persist?: boolean } = {},
): void {
  const accountId = credentials.accountId.trim()
  const privateKey = credentials.privateKey.trim()
  if (!accountId || !privateKey) {
    throw new Error("Demo keypair requires accountId and privateKey")
  }
  if (!privateKey.startsWith("ed25519:")) {
    throw new Error("Demo private key must be an ed25519:… secret key string")
  }
  memorySession = { accountId, privateKey }
  if (options.persist !== false && isBrowser()) {
    window.sessionStorage.setItem(
      DEMO_KEYPAIR_STORAGE_KEY,
      JSON.stringify(memorySession),
    )
  }
  notify()
}

export function clearDemoKeypairSession(): void {
  memorySession = null
  if (isBrowser()) {
    window.sessionStorage.removeItem(DEMO_KEYPAIR_STORAGE_KEY)
    try {
      delete (
        window as Window & {
          [DEMO_KEYPAIR_WINDOW_KEY]?: DemoKeypairCredentials
        }
      )[DEMO_KEYPAIR_WINDOW_KEY]
    } catch {
      // ignore non-configurable
    }
  }
  notify()
}

/** Hydrate from window injection / sessionStorage once on the client. */
export function hydrateDemoKeypairFromRuntime(): DemoKeypairCredentials | null {
  const existing = getDemoKeypairSession()
  if (existing) return existing
  return null
}

export function resetDemoKeypairSessionForTests(): void {
  memorySession = null
  listeners.clear()
}
