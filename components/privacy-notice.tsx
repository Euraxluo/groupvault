import { Eye } from "lucide-react"

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-950"
          : "flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
      }
    >
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Chat messages are stored as public on-chain logs. Anyone can read them,
        and indexing may lag behind the finalized chain. There is no end-to-end
        encryption in this demo.
      </p>
    </div>
  )
}
