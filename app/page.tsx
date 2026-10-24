import {
  ArrowDownRight,
  CheckCircle2,
  KeyRound,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const path = [
  {
    number: "01",
    title: "Create a paid group",
    copy: "Owner signs once. Name, description, join fee, and the NEP-141 token live on GroupVault.",
  },
  {
    number: "02",
    title: "Join with the exact FT",
    copy: "A wallet sends ft_transfer_call. Wrong token, wrong message, duplicate, or underpayment is refunded.",
  },
  {
    number: "03",
    title: "Chat in public",
    copy: "Member messages become canonical env::log_str events. A small indexer makes history readable.",
  },
  {
    number: "04",
    title: "Convert in one signature",
    copy: "The owner calls convert_to_dao. GroupVault calls Sputnik factory.create and writes dao_id only after the callback succeeds.",
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
    <main className="relative min-h-screen overflow-hidden bg-[#f4f0e6] text-[#17211a]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(199,243,107,0.55),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(255,153,102,0.28),transparent_28%)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-10 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#17211a]/15 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#17211a] font-mono text-sm font-bold text-[#c7f36b]">
              GV
            </span>
            <div>
              <p className="text-base font-bold tracking-tight">GroupVault</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#17211a]/55">
                NEAR testnet
              </p>
            </div>
          </div>
          <Badge className="border-[#17211a]/20 bg-transparent font-mono text-[10px] uppercase tracking-[0.14em] text-[#17211a]">
            Engineering shell
          </Badge>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:py-20">
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
              server signer, a threshold-key ceremony, or a fake transaction.
              One owner signature starts the conversion.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="h-11 rounded-full bg-[#17211a] px-6 text-[#f8f4e9] hover:bg-[#2b3a2e]"
              >
                <a href="#demo-path">
                  See the demo path <ArrowDownRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <span className="flex items-center gap-2 rounded-full border border-[#17211a]/20 px-4 py-2.5 text-xs font-medium text-[#17211a]/65">
                <ShieldCheck className="h-4 w-4" />
                No server-side signing
              </span>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.13em] text-[#17211a]/50">
              <span>Factory: sputnikv2.testnet</span>
              <span>Messages: plaintext logs</span>
              <span>Web: copied Next shell</span>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[2rem] bg-[#17211a] p-6 text-[#f8f4e9] shadow-[0_30px_80px_-30px_rgba(23,33,26,0.7)] sm:p-8">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[32px] border-[#c7f36b]/15"
            />
            <div className="relative">
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
                {path.map((step) => (
                  <li key={step.number} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <span className="font-mono text-xs text-[#c7f36b]">{step.number}</span>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#f8f4e9]/55">{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex items-start gap-2 rounded-2xl border border-[#f8f4e9]/10 bg-[#f8f4e9]/5 p-3">
                <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-[#c7f36b]" />
                <p className="text-[11px] leading-5 text-[#f8f4e9]/65">
                  Paid membership never creates voting weight. Weight only comes
                  from staking the same join FT after the DAO exists.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section id="demo-path" className="scroll-mt-6 pb-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#17211a]/45">
                Product surfaces
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">One chain, four boundaries</h2>
            </div>
            <p className="hidden max-w-sm text-right text-xs leading-5 text-[#17211a]/55 sm:block">
              The copied mobile-first shell stays. Sui execution is removed from
              the active path before wallet flows are enabled.
            </p>
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

        <section
          id="status"
          className="mb-8 grid gap-4 rounded-[2rem] border border-[#17211a]/15 bg-[#faf7ef]/80 p-6 backdrop-blur sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#17211a]/45">
              Current build
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight">
              Real shell first. Chain actions next.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#17211a]/60">
              This page intentionally shows no invented groups, balances, or
              messages. Contract, indexer, wallet, and demo evidence arrive as
              separate gated tasks.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#c7f36b]/35 px-4 py-2 text-xs font-semibold text-[#2f4a25]">
            <CheckCircle2 className="h-4 w-4" />
            Toolchain gate in progress
          </div>
        </section>
      </div>
    </main>
  )
}
