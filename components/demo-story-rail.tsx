"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DEFAULT_STORY_STEPS,
  DEMO_STORY,
  type StoryStep,
} from "@/lib/demo-story"

export function DemoStoryRail({
  steps = DEFAULT_STORY_STEPS,
  compact = false,
}: {
  steps?: StoryStep[]
  compact?: boolean
}) {
  return (
    <section className="space-y-3" id="demo-story-rail">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Demo story
          </p>
          <h2 className="text-lg font-bold tracking-tight">
            Connect → group → Convert → stake → Transfer
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Deep-links use group {DEMO_STORY.groupId} /{" "}
            <span className="font-mono">{DEMO_STORY.daoId}</span>. Create fresh
            if you need a new path.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {DEMO_STORY.network}
        </Badge>
      </div>

      <div
        className={
          compact
            ? "flex gap-2 overflow-x-auto pb-1"
            : "grid gap-2 sm:grid-cols-2"
        }
      >
        {steps.map((step) => (
          <Card
            key={step.id}
            className={
              compact
                ? "min-w-[11rem] shrink-0 shadow-none"
                : "shadow-none transition-shadow hover:shadow-sm"
            }
          >
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-primary">
                  {step.number}
                </span>
                <span className="truncate text-[10px] uppercase text-muted-foreground">
                  {step.id}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{step.title}</p>
              {!compact ? (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {step.copy}
                </p>
              ) : null}
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={step.href}>
                  {step.cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
