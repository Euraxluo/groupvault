import { expect, test } from "@playwright/test"

import { DEMO_STORY } from "../../lib/demo-story"

test.describe("storyline click-through surfaces", () => {
  test("demo rail and every story route render a primary CTA", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.goto("/demo", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { level: 1, name: /Demo story/i }),
    ).toBeVisible()
    await expect(page.locator("#demo-story-rail")).toBeVisible()
    await expect(page.getByRole("link", { name: /Join group/i })).toBeVisible()

    const checks: { path: string; heading: RegExp; cta: RegExp }[] = [
      { path: "/", heading: /A group chat with a treasury/i, cta: /Demo story/i },
      { path: "/groups/new", heading: /New group/i, cta: /Open create form|Create/i },
      { path: "/groups", heading: /Groups/i, cta: /New/i },
      { path: "/discover", heading: /Discover/i, cta: /New|My groups/i },
      {
        path: `/groups/${DEMO_STORY.groupId}/join`,
        heading: /Paid join/i,
        cta: /Pay and join|Owner is already|Connect a wallet|Continue to overview|Group not found|Enter a group/i,
      },
      {
        path: `/groups/${DEMO_STORY.groupId}`,
        heading: /.+/,
        cta: /Chat|Paid join|Convert|Open DAO|Back to groups|Details/i,
      },
      {
        path: `/groups/${DEMO_STORY.groupId}/chat`,
        heading: /.+/,
        cta: /Send|Connect|Group overview|not a member|indexing/i,
      },
      {
        path: `/groups/${DEMO_STORY.groupId}/convert`,
        heading: /Convert|DAO/i,
        cta: /Convert with wallet|Open DAO|Refresh|Back/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}`,
        heading: /DAO/i,
        cta: /Staking setup|Stake|Treasury|Proposals|Inbox/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}/staking/setup`,
        heading: /Staking setup/i,
        cta: /SetStaking|TokenWeight|Storage deposit|Connect/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}/stake`,
        heading: /Stake/i,
        cta: /Storage deposit|Delegate|Staking setup|not set/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}/treasury`,
        heading: /DAO treasury|treasury/i,
        cta: /Fund DAO|Add Transfer|Transfer/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}/proposals?ids=${DEMO_STORY.proposalIds.join(",")}`,
        heading: /Proposals/i,
        cta: /Load|Approve|Details/i,
      },
      {
        path: `/dao/${DEMO_STORY.daoId}/proposals/${DEMO_STORY.transferProposalId}`,
        heading: /Proposal #/i,
        cta: /Approve exact kind|Proposal not found|Connect/i,
      },
      { path: "/me/qr", heading: /QR card/i, cta: /Connect|Copy account|Open inbox/i },
      { path: "/inbox", heading: /Inbox/i, cta: /Demo|Create a Transfer|Open|Connect/i },
    ]

    for (const check of checks) {
      await page.goto(check.path, { waitUntil: "domcontentloaded" })
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(check.cta).first()).toBeVisible({
        timeout: 30_000,
      })
    }
  })

  test("navbar exposes Groups Chat DAO Inbox", async ({ page }) => {
    await page.goto("/demo")
    await expect(page.getByRole("navigation").getByText("Groups")).toBeVisible()
    await expect(page.getByRole("navigation").getByText("Chat")).toBeVisible()
    await expect(page.getByRole("navigation").getByText("DAO")).toBeVisible()
    await expect(page.getByRole("navigation").getByText("Inbox")).toBeVisible()
  })
})
