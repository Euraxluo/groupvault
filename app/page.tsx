import {
  ArrowRight,
  KeyRound,
  MessageSquareText,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
} from "lucide-react"
import Link from "next/link"

import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const steps = [
  {
    number: "01",
    title: "Create a paid group",
    copy: "The owner signs once. Name, description, join fee, and the NEP-141 token live on GroupVault.",
  },
  {
    number: "02",
    title: "Join with the exact FT",
    copy: "A wallet sends ft_transfer_call. A wrong token, bad message, duplicate, or underpayment is refunded.",
  },
  {
    number: "03",
    title: "Chat in public",
    copy: "Member messages become canonical env::log_str events; a small indexer makes history readable.",
  },
  {
    number: "04",
    title: "Convert in one signature",
    copy: "GroupVault calls Sputnik factory.create and writes dao_id only after the boolean callback succeeds.",
  },
]

const surfaces = [
  { icon: Users, label: "Membership", value: "Paid join, no vote by default" },
  { icon: MessageSquareText, label: "Chat", value: "Public logs, no E2E claim" },
  { icon: Wallet, label: "Signing", value: "Wallet selector only" },
  { icon: Vote, label: "Governance", value: "Sputnik TokenWeight" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f0e6] text-[#17211a]">
      <MobileNavbar />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-28 pt-20 sm:px-8 md:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(199,243,107,0.45),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(255,153,102,0.24),transparent_28%)]"
        />

        <section className="relative grid flex-1 items-center gap-12 py-8 lg:grid-cols-[1.12fr_0.88fr] lg:py-14">
          <div>
            <p className="mb-5 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3c5a3f]">
              <span className="h-2 w-2 rounded-full bg-[#5c8f3e]" />
              Paid groups / public chat / Sputnik DAO
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              A group chat with a{" "}
              <span className="relative inline-block">
                treasury
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 -z-10 h-4 -rotate-1 bg-[#c7f36b]"
                />
              </span>{" "}
              at the end.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#17211a]/70 sm:text-lg">
              GroupVault turns a paid NEP-141 group into a Sputnik DAO without a
              backend signature, a threshold-key ceremony, or a fake transaction.
              One owner signature starts the conversion.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="h-11 rounded-full bg-[#17211a] px-6 text-[#f8f4e9] hover:bg-[#2b3a2e]"
              >
                <Link href="/groups">
                  Open groups <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <span className="flex items-center gap-2 rounded-full border border-[#17211a]/20 px-4 py-2.5 text-xs font-medium text-[#17211a]/65">
                <ShieldCheck className="h-4 w-4" />
                No backend signing
              </span>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.13em] text-[#17211a]/50">
              <span>Factory: sputnikv2.testnet</span>
              <span>Messages: plaintext logs</span>
              <span>Network: NEAR testnet</span>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[2rem] bg-[#17211a] p-6 text-[#f8f4e9] shadow-[0_30px_80px_-30px_rgba(23,33,26,0.7)] sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c7f36b]">
                  Conversion contract
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  Four real steps.
                  <br />
                  No hidden ceremony.
                </h2>
              </div>
              <KeyRound className="h-7 w-7 text-[#c7f36b]" />
            </div>

            <ol className="mt-8 space-y-5">
              {steps.map((step) => (
                <li key={step.number} className="grid grid-cols-[2.5rem_1fr] gap-3">
                  <span className="font-mono text-xs text-[#c7f36b]">{step.number}</span>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#f8f4e9]/55">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 rounded-2xl border border-[#f8f4e9]/10 bg-[#f8f4e9]/5 p-3 text-[11px] leading-5 text-[#f8f4e9]/65">
              Paid membership never creates voting weight. Weight only comes from
              staking the same join FT after the DAO exists.
            </p>
          </aside>
        </section>

        <section className="relative pb-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#17211a]/45">
                Product surfaces
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">One chain, four boundaries</h2>
            </div>
            <Badge className="border-[#17211a]/20 bg-transparent font-mono text-[10px] uppercase tracking-[0.14em] text-[#17211a]">
              NEAR testnet
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {surfaces.map(({ icon: Icon, label, value }) => (
              <Card
                key={label}
                className="rounded-2xl border-[#17211a]/15 bg-[#faf7ef]/80 shadow-none backdrop-blur"
              >
                <CardContent className="p-5">
                  <Icon className="h-5 w-5 text-[#3c5a3f]" />
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#17211a]/45">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
