import {
  ArrowRight,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
} from "lucide-react"
import Link from "next/link"

import { DemoStoryRail } from "@/components/demo-story-rail"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DEMO_STORY } from "@/lib/demo-story"

const quickActions = [
  {
    href: "/groups/new",
    label: "Create group",
    copy: "Owner signs once",
    icon: Plus,
    primary: true,
  },
  {
    href: "/discover",
    label: "Discover",
    copy: "Join with FT",
    icon: Users,
  },
  {
    href: `/groups/${DEMO_STORY.groupId}/chat`,
    label: "Open chat",
    copy: `Group ${DEMO_STORY.groupId}`,
    icon: MessageSquareText,
  },
  {
    href: `/dao/${DEMO_STORY.daoId}`,
    label: "DAO hub",
    copy: "Stake · vote",
    icon: Vote,
  },
] as const

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-28 pt-20">
        <section className="rounded-2xl bg-zinc-950 p-4 text-zinc-50 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                NearDao · testnet
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight">
                Paid group → chat → Convert → stake
              </h1>
              <p className="mt-2 text-sm leading-5 text-zinc-300">
                Real Sputnik DAO. No fake txs. Connect and take the next step.
              </p>
            </div>
            <Badge className="shrink-0 border-emerald-400/30 bg-emerald-400/10 font-mono text-[10px] text-emerald-200">
              live
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              asChild
              className="h-11 min-h-11 rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
            >
              <Link href="/demo">
                Demo story <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 min-h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-50 hover:bg-zinc-800"
            >
              <Link href="/groups">My groups</Link>
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            Wallet selector · Keypair demo OK · no backend signing
          </p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
          const { href, label, copy, icon: Icon } = action
          const primary = "primary" in action && action.primary
          return (
            <Link key={href} href={href} className="block">
              <Card
                className={
                  primary
                    ? "h-full border-primary/30 bg-primary/5 shadow-none"
                    : "h-full shadow-none"
                }
              >
                <CardContent className="flex min-h-[5.5rem] flex-col justify-between gap-2 p-3.5">
                  <Icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold leading-snug">{label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )})}
        </section>

        <section className="rounded-2xl border border-border bg-card p-3">
          <DemoStoryRail compact />
        </section>

        <section className="grid gap-2">
          <div className="flex items-center justify-between px-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Product boundaries
            </p>
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Card className="shadow-none">
              <CardContent className="p-3">
                <p className="font-medium">Membership</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Paid join ≠ vote
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-3">
                <p className="font-medium">Chat</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Public on-chain logs
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-3">
                <p className="font-medium">Convert</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  One owner signature
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-3">
                <p className="font-medium">Governance</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Sputnik TokenWeight
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
