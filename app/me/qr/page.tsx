"use client"

import Link from "next/link"

import { AccountQr } from "@/components/account-qr"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"

export default function MeQrPage() {
  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-28 pt-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR card</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Share your NEAR accountId. No on-chain dependency.
          </p>
        </div>
        <AccountQr />
        <Button asChild variant="outline" className="w-full">
          <Link href="/inbox">Open inbox</Link>
        </Button>
      </div>
    </main>
  )
}
