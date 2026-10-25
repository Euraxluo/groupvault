"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useNearWallet } from "@/hooks/use-near-wallet"

export function AccountQr() {
  const wallet = useNearWallet()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet.accountId) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(wallet.accountId, { width: 280, margin: 2 })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })
    return () => {
      cancelled = true
    }
  }, [wallet.accountId])

  if (!wallet.accountId) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Connect a wallet to show your QR card. Use the Connect button in the
          navbar.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR for ${wallet.accountId}`}
            className="h-56 w-56 rounded-xl border bg-white p-2"
          />
        ) : (
          <div className="grid h-56 w-56 place-items-center rounded-xl border text-xs text-muted-foreground">
            {error ?? "Generating QR…"}
          </div>
        )}
        <p className="break-all text-center font-mono text-xs">{wallet.accountId}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(wallet.accountId!)
            setCopied(true)
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy account"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Frontend-only QR of your NEAR accountId. No on-chain call.
        </p>
      </CardContent>
    </Card>
  )
}
