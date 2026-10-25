import { describe, expect, it } from "vitest"

import { DEFAULT_STORY_STEPS, DEMO_STORY, buildStorySteps } from "./demo-story"

describe("demo story", () => {
  it("covers the §5 click path including Should surfaces", () => {
    const ids = DEFAULT_STORY_STEPS.map((step) => step.id)
    expect(ids).toContain("join")
    expect(ids).toContain("stake")
    expect(ids).toContain("proposal-detail")
    expect(ids).toContain("qr")
    expect(ids).toContain("inbox")
    expect(DEMO_STORY.groupId).toBe(13)
    expect(DEMO_STORY.daoId).toContain("sputnikv2.testnet")
  })

  it("builds deep links from anchors", () => {
    const steps = buildStorySteps({
      groupId: 99,
      daoId: "x.sputnikv2.testnet",
      proposalId: 7,
    })
    expect(steps.find((s) => s.id === "join")?.href).toBe("/groups/99/join")
    expect(steps.find((s) => s.id === "stake")?.href).toBe(
      "/dao/x.sputnikv2.testnet/stake",
    )
    expect(steps.find((s) => s.id === "proposal-detail")?.href).toBe(
      "/dao/x.sputnikv2.testnet/proposals/7",
    )
  })
})
