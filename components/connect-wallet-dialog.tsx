"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Loader2,
  LogOut,
  Sparkles,
  Wallet,
} from "lucide-react"

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
import { useNearWallet } from "@/hooks/use-near-wallet"

export interface ConnectWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AccountListResponse {
  accounts?: unknown
  error?: unknown
}

interface KeypairResponse {
  accountId?: unknown
  privateKey?: unknown
  funded?: unknown
  error?: unknown
}

export function shortAccount(accountId: string): string {
  if (accountId.length <= 18) return accountId
  return `${accountId.slice(0, 8)}…${accountId.slice(-6)}`
}

function errorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error
  }
  return fallback
}

async function readDemoJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function requestDemoJson(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      "x-gv-demo": "1",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  })
  const payload = await readDemoJson(response)
  if (!response.ok) {
    throw new Error(
      errorMessage(payload, `演示账号服务请求失败（HTTP ${response.status}）`),
    )
  }
  return payload
}

export function ConnectWalletDialog({
  open,
  onOpenChange,
}: ConnectWalletDialogProps) {
  const wallet = useNearWallet()
  const [signingOut, setSigningOut] = useState(false)
  const [showKeypair, setShowKeypair] = useState(false)
  const [accounts, setAccounts] = useState<string[]>([])
  const [selectedAccount, setSelectedAccount] = useState("")
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [connectingExisting, setConnectingExisting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [accountIdInput, setAccountIdInput] = useState("")
  const [privateKeyInput, setPrivateKeyInput] = useState("")

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setDemoError(null)
    try {
      const payload = (await requestDemoJson("/api/demo/accounts")) as
        | AccountListResponse
        | null
      if (!payload || !Array.isArray(payload.accounts)) {
        throw new Error("本机账号列表返回格式无效")
      }
      const nextAccounts = payload.accounts.filter(
        (account): account is string => typeof account === "string",
      )
      setAccounts(nextAccounts)
      setSelectedAccount((current) =>
        current && nextAccounts.includes(current) ? current : "",
      )
    } catch (reason) {
      setDemoError(
        reason instanceof Error ? reason.message : "无法读取本机演示账号",
      )
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    if (open && showKeypair && !wallet.accountId) {
      void loadAccounts()
    }
  }, [open, showKeypair, wallet.accountId, loadAccounts])

  useEffect(() => {
    if (!open) {
      setDemoError(null)
    }
  }, [open])

  async function connectCredentials(credentials: {
    accountId: string
    privateKey: string
  }): Promise<void> {
    await wallet.connectKeypair(credentials)
    setPrivateKeyInput("")
    setAccountIdInput("")
    setDemoError(null)
    onOpenChange(false)
  }

  async function connectExisting(): Promise<void> {
    if (!selectedAccount) return
    setConnectingExisting(true)
    setDemoError(null)
    try {
      const payload = (await requestDemoJson("/api/demo/keypair", {
        method: "POST",
        body: JSON.stringify({ accountId: selectedAccount }),
      })) as KeypairResponse | null
      if (
        !payload ||
        payload.accountId !== selectedAccount ||
        typeof payload.privateKey !== "string" ||
        !payload.privateKey
      ) {
        throw new Error("本机账号凭据返回格式无效")
      }
      await connectCredentials({
        accountId: payload.accountId,
        privateKey: payload.privateKey,
      })
    } catch (reason) {
      setDemoError(
        reason instanceof Error ? reason.message : "连接本机账号失败",
      )
    } finally {
      setConnectingExisting(false)
    }
  }

  async function createDemoAccount(): Promise<void> {
    setCreating(true)
    setDemoError(null)
    try {
      const payload = (await requestDemoJson("/api/demo/create", {
        method: "POST",
      })) as KeypairResponse | null
      if (
        !payload ||
        payload.funded !== true ||
        typeof payload.accountId !== "string" ||
        typeof payload.privateKey !== "string" ||
        !payload.accountId ||
        !payload.privateKey
      ) {
        throw new Error(
          errorMessage(payload, "创建演示账号失败，请重试或手动贴 key"),
        )
      }
      await connectCredentials({
        accountId: payload.accountId,
        privateKey: payload.privateKey,
      })
    } catch (reason) {
      setDemoError(
        reason instanceof Error
          ? reason.message
          : "创建演示账号失败，请重试或手动贴 key",
      )
    } finally {
      setCreating(false)
    }
  }

  const connectingKeypair = connectingExisting || creating || wallet.connecting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>连接 NEAR 钱包</DialogTitle>
          <DialogDescription>
            使用 MyNearWallet 签名，或选择 testnet 演示密钥零配置体验。
            演示私钥只保存在当前标签页。
          </DialogDescription>
        </DialogHeader>

        {wallet.accountId ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              当前账号
              {wallet.keypairMode ? " · 演示密钥" : ""}
            </p>
            <p className="mt-1 break-all font-mono text-sm">{wallet.accountId}</p>
          </div>
        ) : showKeypair ? (
          <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
            <div>
              <p className="text-sm font-medium">演示密钥 · 仅 testnet</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Demo keypair · private keys stay in this tab&apos;s
                sessionStorage.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="gv-demo-existing">选择本机账号</Label>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                  disabled={loadingAccounts || connectingKeypair}
                  onClick={() => void loadAccounts()}
                >
                  刷新
                </button>
              </div>
              <select
                id="gv-demo-existing"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedAccount}
                disabled={
                  loadingAccounts || connectingKeypair || !accounts.length
                }
                onChange={(event) => setSelectedAccount(event.target.value)}
              >
                <option value="">
                  {loadingAccounts
                    ? "正在读取本机账号…"
                    : accounts.length
                      ? "请选择账号"
                      : "本机暂无 testnet 账号"}
                </option>
                {accounts.map((accountId) => (
                  <option key={accountId} value={accountId}>
                    {accountId}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={
                  !wallet.ready ||
                  connectingKeypair ||
                  !selectedAccount ||
                  !accounts.includes(selectedAccount)
                }
                onClick={() => void connectExisting()}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {connectingExisting ? "正在连接…" : "连接所选账号"}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">一键创建演示账号（自动领 gas）</p>
              <p className="text-[11px] text-muted-foreground">
                新建 gv-demo-…testnet，领取 10 NEAR 后自动连接。
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={!wallet.ready || connectingKeypair}
                onClick={() => void createDemoAccount()}
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {creating ? "正在创建…" : "一键创建并连接"}
              </Button>
              {creating ? (
                <p
                  className="rounded-md bg-background/80 px-2.5 py-2 text-[11px] text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  正在创建并领取 gas…约 30–60 秒，请保持页面打开。
                </p>
              ) : null}
            </div>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer select-none text-sm font-medium">
                手动贴 key
              </summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gv-demo-account">账号 ID</Label>
                  <Input
                    id="gv-demo-account"
                    autoComplete="off"
                    placeholder="gv-a-….testnet"
                    value={accountIdInput}
                    onChange={(event) => setAccountIdInput(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gv-demo-secret">私钥</Label>
                  <Input
                    id="gv-demo-secret"
                    type="password"
                    autoComplete="off"
                    placeholder="测试网私钥"
                    value={privateKeyInput}
                    onChange={(event) => setPrivateKeyInput(event.target.value)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  粘贴一个已领取 gas 的 testnet 密钥，仅用于当前标签页。切勿提交到
                  git。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={
                    !wallet.ready ||
                    connectingKeypair ||
                    !accountIdInput.trim() ||
                    !privateKeyInput.trim()
                  }
                  onClick={() =>
                    void connectCredentials({
                      accountId: accountIdInput,
                      privateKey: privateKeyInput,
                    }).catch((reason: unknown) => {
                      setDemoError(
                        reason instanceof Error
                          ? reason.message
                          : "连接演示密钥失败",
                      )
                    })
                  }
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {wallet.connecting ? "正在连接…" : "连接手动密钥"}
                </Button>
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">MyNearWallet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    使用浏览器钱包连接并签名。
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={!wallet.ready || wallet.connecting}
                onClick={() => void wallet.connect()}
              >
                <Wallet className="mr-2 h-4 w-4" />
                {wallet.connecting ? "等待钱包确认…" : "连接 MyNearWallet"}
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium">没有钱包？</p>
              <p className="mt-1 text-xs text-muted-foreground">
                选择本机已有账号、一键创建带 gas 的演示账号，或手动贴
                key。仅限 NEAR testnet。
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full"
                disabled={!wallet.ready || wallet.connecting}
                onClick={() => setShowKeypair(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                演示密钥 · 仅 testnet
              </Button>
            </div>
          </div>
        )}

        {demoError ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {demoError}
          </p>
        ) : null}

        {wallet.error ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {wallet.error}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {wallet.accountId ? (
            <Button
              variant="outline"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true)
                await wallet.disconnect()
                setSigningOut(false)
                setShowKeypair(false)
                setPrivateKeyInput("")
                onOpenChange(false)
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {signingOut ? "正在断开…" : "断开连接"}
            </Button>
          ) : showKeypair ? (
            <Button
              variant="ghost"
              disabled={connectingKeypair}
              onClick={() => {
                setShowKeypair(false)
                setDemoError(null)
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
