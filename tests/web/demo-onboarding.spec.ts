import { expect, test, type Page, type Route } from "@playwright/test"
import { KeyPair } from "near-api-js"

const ACCOUNT_A = "gv-demo-alpha.testnet"
const ACCOUNT_B = "gv-demo-beta.testnet"
const CREATED_ACCOUNT = "gv-demo-new.testnet"
const MOCK_PRIVATE_KEY = KeyPair.fromRandom("ed25519").toString()

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

async function openDemoPanel(page: Page): Promise<void> {
  // QR page keeps the navbar but never triggers an account-balance RPC, so
  // this gate stays fully offline.
  await page.goto("/me/qr")
  await page.locator("#btn-nav-wallet").click()
  await expect(
    page.getByRole("heading", { name: "连接 NEAR 钱包" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "演示密钥 · 仅 testnet" }).click()
  await expect(page.getByText("演示密钥 · 仅 testnet")).toBeVisible()
}

test.describe("demo account onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/demo/accounts", async (route) => {
      expect(route.request().headers()["x-gv-demo"]).toBe("1")
      await json(route, { accounts: [ACCOUNT_A, ACCOUNT_B] })
    })
    await page.route("**/api/demo/keypair", async (route) => {
      expect(route.request().method()).toBe("POST")
      expect(route.request().headers()["x-gv-demo"]).toBe("1")
      const body = route.request().postDataJSON() as { accountId?: string }
      await json(route, {
        accountId: body.accountId ?? ACCOUNT_A,
        privateKey: MOCK_PRIVATE_KEY,
      })
    })
  })

  test("shows all three onboarding paths", async ({ page }) => {
    await openDemoPanel(page)

    await expect(page.getByLabel("选择本机账号")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "一键创建并连接" }),
    ).toBeVisible()
    await expect(page.getByText("手动贴 key")).toBeVisible()
    await expect(page.getByLabel("选择本机账号")).toContainText(ACCOUNT_A)
    await expect(page.getByLabel("选择本机账号")).toContainText(ACCOUNT_B)
  })

  test("selecting a local account connects the wallet chip", async ({ page }) => {
    await openDemoPanel(page)
    await page.getByLabel("选择本机账号").selectOption(ACCOUNT_A)
    await page.getByRole("button", { name: "连接所选账号" }).click()

    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.locator("#btn-nav-wallet")).toHaveAttribute(
      "title",
      ACCOUNT_A,
    )
    await expect(page.locator("#btn-nav-wallet")).toContainText("gv-demo-…estnet")
  })

  test("one-click create shows pending, then connects the funded account", async ({
    page,
  }) => {
    let releaseCreate: (() => void) | undefined
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })
    let createStarted = false
    await page.route("**/api/demo/create", async (route) => {
      createStarted = true
      await createGate
      await json(route, {
        accountId: CREATED_ACCOUNT,
        privateKey: MOCK_PRIVATE_KEY,
        funded: true,
      })
    })

    await openDemoPanel(page)
    await page.getByRole("button", { name: "一键创建并连接" }).click()

    await expect(page.getByRole("status")).toContainText(
      "正在创建并领取 gas…约 30–60 秒",
    )
    expect(createStarted).toBe(true)

    releaseCreate?.()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.locator("#btn-nav-wallet")).toContainText("gv-demo")
    await expect(page.locator("#btn-nav-wallet")).toHaveAttribute(
      "title",
      CREATED_ACCOUNT,
    )
  })

  test("faucet failure stays visible and does not fabricate a connection", async ({
    page,
  }) => {
    await page.route("**/api/demo/create", (route) =>
      json(
        route,
        {
          funded: false,
          error: "水龙头暂不可用，请重试或手动贴 key",
        },
        502,
      ),
    )

    await openDemoPanel(page)
    await page.getByRole("button", { name: "一键创建并连接" }).click()

    await expect(page.getByRole("alert")).toContainText(
      "水龙头暂不可用，请重试或手动贴 key",
    )
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.locator("#btn-nav-wallet")).toContainText("连接")
  })
})
