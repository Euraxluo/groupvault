import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 5 * 60 * 1000,
  expect: { timeout: 90_000 },
  reporter: [["list"]],
  use: {
    // Port 3000 is commonly occupied by other local services; use 3100 so the
    // test can never accidentally exercise a different app.
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    // Always start a fresh server so NEXT_PUBLIC_* values are compiled into the
    // client bundle for this exact run. A stale server with different config
    // must never be reused.
    command: "pnpm dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
