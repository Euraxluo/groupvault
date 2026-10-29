"use client"

import { useState } from "react"
import { Compass, MessageSquareText, Wallet } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ConnectWalletDialog, shortAccount } from "@/components/connect-wallet-dialog"
import { Button } from "@/components/ui/button"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/chat", label: "消息", icon: MessageSquareText },
  { href: "/discover", label: "发现", icon: Compass },
  { href: "/me", label: "我的", icon: Wallet },
] as const

/** Chat under /groups/:id/chat must light 消息. */
function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === "/chat") {
    return pathname === "/chat" || /\/groups\/[^/]+\/chat(?:\/|$)/.test(pathname)
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNavbar() {
  const pathname = usePathname()
  const wallet = useNearWallet()
  const [walletOpen, setWalletOpen] = useState(false)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              GV
            </span>
            <span className="truncate text-sm font-bold tracking-tight">GroupVault</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 min-h-9 rounded-full px-2.5 text-xs"
            >
              <Link href="/me/qr">QR</Link>
            </Button>
            <Button
              id="btn-nav-wallet"
              variant="outline"
              size="sm"
              className="h-9 min-h-9 max-w-[9.5rem] rounded-full px-3 text-xs"
              onClick={() => setWalletOpen(true)}
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {wallet.accountId ? shortAccount(wallet.accountId) : "连接"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-lg justify-around">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      <ConnectWalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  )
}
