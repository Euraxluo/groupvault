import { expect, test } from "@playwright/test"

const GROUP_ID = 16
const DAO_ID = "gv16-8jh4.sputnikv2.testnet"

test.describe("secondary capabilities after Jobs IA", () => {
  test("DAO hub keeps treasury, proposals, staking and stake links", async ({
    page,
  }) => {
    await page.goto(`/dao/${DAO_ID}`, { waitUntil: "domcontentloaded" })

    await expect(
      page.getByRole("heading", { level: 1, name: /DAO/ }),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: /质押设置/ })).toHaveAttribute(
      "href",
      `/dao/${DAO_ID}/staking/setup`,
    )
    await expect(
      page.getByRole("link", { name: /质押 \/ 委托/ }),
    ).toHaveAttribute("href", `/dao/${DAO_ID}/stake`)
    await expect(
      page.getByRole("link", { name: /金库与转账/ }),
    ).toHaveAttribute("href", `/dao/${DAO_ID}/treasury`)
    await expect(page.getByRole("link", { name: /提案/ })).toHaveAttribute(
      "href",
      `/dao/${DAO_ID}/proposals`,
    )
  })

  test("proposal list scans recent real chain ids", async ({ page }) => {
    // Public testnet RPC can rate-limit; six real proposal reads need headroom.
    test.setTimeout(150_000)
    await page.goto(`/dao/${DAO_ID}/proposals`, {
      waitUntil: "domcontentloaded",
    })

    await expect(
      page.getByRole("heading", { level: 1, name: "提案" }),
    ).toBeVisible()
    await expect(page.getByText(/链上最近 10 个提案/)).toBeVisible()
    await expect(page.locator("body")).toContainText(
      /TokenWeight micro Transfer|TokenWeight Transfer|Set GroupVault staking contract|Change policy to TokenWeight/,
      { timeout: 120_000 },
    )
    await expect(
      page.getByRole("link", { name: "详情" }).first(),
    ).toHaveAttribute("href", new RegExp(`^/dao/${DAO_ID}/proposals/\\d+$`))
    await expect(page.locator("body")).not.toContainText("groupvault-13")
  })

  test("staking, treasury, QR and paid Join stay reachable", async ({ page }) => {
    const checks: { path: string; heading: RegExp; cta: RegExp }[] = [
      {
        path: `/dao/${DAO_ID}/staking/setup`,
        heading: /Staking setup/,
        cta: /SetStaking|TokenWeight|Storage deposit|Connect/i,
      },
      {
        path: `/dao/${DAO_ID}/stake`,
        heading: /Stake/,
        cta: /Storage deposit|Delegate|Staking setup|not set/i,
      },
      {
        path: `/dao/${DAO_ID}/treasury`,
        heading: /金库|treasury/i,
        cta: /从钱包转入金库|添加转账提案|转入金额/,
      },
      {
        path: "/me/qr",
        heading: /我的二维码/,
        cta: /返回我的|Connect|扫码/,
      },
      {
        path: `/groups/${GROUP_ID}/join`,
        heading: /付费进群/,
        cta: /入群币|群主已是成员|先连接钱包/,
      },
      {
        path: `/groups/${GROUP_ID}/convert`,
        heading: /升级为 DAO|已是 DAO|Convert/i,
        cta: /确认升级|查看金库|回到群聊|Open DAO|Refresh|Back/i,
      },
    ]

    for (const check of checks) {
      await page.goto(check.path, { waitUntil: "domcontentloaded" })
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(check.cta).first()).toBeVisible({
        timeout: 30_000,
      })
    }
  })

  test("legacy inbox redirects and is not a capability entry", async ({
    page,
  }) => {
    await page.goto("/inbox")
    await expect(page).toHaveURL(/\/chat$/)

    const nav = page.getByRole("navigation", { name: "Primary" })
    await expect(nav.getByRole("link")).toHaveCount(3)
    await expect(nav).not.toContainText("Inbox")
  })
})
