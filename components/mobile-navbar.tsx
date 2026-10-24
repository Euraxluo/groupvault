"use client"

import { useState } from "react"
import { MessageSquareText, Users, Vote, Wallet } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ConnectWalletDialog, shortAccount } from "@/components/connect-wallet-dialog"
import { Button } from "@/components/ui/button"
import { useNearWallet } from "@/hooks/use-near-wallet"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/dao", label: "DAO", icon: Vote },
]

export function MobileNavbar() {
  const pathname = usePathname()
  const wallet = useNearWallet()
  const [walletOpen, setWalletOpen] = useState(false)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md md:left-1/2 md:top-3 md:max-w-3xl md:-translate-x-1/2 md:rounded-2xl md:border">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              GV
            </span>
            <span className="text-sm font-bold tracking-tight">GroupVault</span>
          </Link>

          <Button
            id="btn-nav-wallet"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => setWalletOpen(true)}
          >
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            {wallet.accountId ? shortAccount(wallet.accountId) : "Connect"}
          </Button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border/60 bg-background/95 px-2 py-1 backdrop-blur-md md:bottom-3 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-lg">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (pathname?.startsWith(`${href}/`) ?? false)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>

      <ConnectWalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  )
}
