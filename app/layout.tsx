import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import "@near-wallet-selector/modal-ui/styles.css"

export const metadata: Metadata = {
  title: "GroupVault",
  description:
    "Paid groups, public chat logs, and one-signature conversion to a Sputnik DAO on NEAR.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
