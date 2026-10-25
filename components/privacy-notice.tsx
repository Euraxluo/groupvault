"use client"

import { useState } from "react"
import { ChevronDown, Eye } from "lucide-react"

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)

  if (!compact) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Chat messages are stored as public on-chain logs. Anyone can read them,
          and indexing may lag behind the finalized chain. There is no end-to-end
          encryption in this demo.
        </p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="flex w-full items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-left text-[12px] leading-5 text-amber-950"
      aria-expanded={open}
    >
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {open ? (
          <>
            Chat messages are public on-chain logs. Anyone can read them, indexing
            may lag, and there is no end-to-end encryption in this demo.
          </>
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span>Public on-chain chat · no E2E</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </span>
        )}
      </span>
    </button>
  )
}
