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
          <h1 className="text-2xl font-bold tracking-tight">我的二维码</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            分享你的 NEAR 账户地址；扫码不产生任何链上交易。
          </p>
        </div>
        <AccountQr />
        <Button asChild variant="outline" className="w-full">
          <Link href="/me">返回我的</Link>
        </Button>
      </div>
    </main>
  )
}
