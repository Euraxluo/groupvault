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
          聊天内容会写入公开链上日志，任何人都能读取；索引器可能延迟展示；本演示没有端到端加密。
        </p>
      </div>
    )
  }

  return (
    <button
      type="button"
      data-privacy-notice
      onClick={() => setOpen((value) => !value)}
      className="flex w-full items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-left text-[12px] leading-5 text-amber-950"
      aria-expanded={open}
    >
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {open ? (
          <span data-privacy-detail>
            聊天是公开链上日志，任何人都能读取；索引器可能延迟；本演示没有端到端加密。
          </span>
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span>公开链上聊天 · 可能延迟 · 无端到端加密</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </span>
        )}
      </span>
    </button>
  )
}
