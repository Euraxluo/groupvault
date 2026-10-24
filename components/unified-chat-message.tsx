"use client"

import { formatDistanceToNow } from "date-fns"

import type { ChatMessage } from "@/lib/near/indexer"

function timestamp(ts: string): string {
  try {
    const millis = Number(BigInt(ts) / 1_000_000n)
    return formatDistanceToNow(new Date(millis), { addSuffix: true })
  } catch {
    return "time unavailable"
  }
}

export function UnifiedChatMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {message.sender.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-all font-mono text-[11px] font-medium">
            {message.sender}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {timestamp(message.ts)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
          {message.text}
        </p>
      </div>
    </div>
  )
}
