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
  webServer: [
    {
      // Always start a fresh server so NEXT_PUBLIC_* values are compiled into
      // the client bundle for this exact run. A stale server with different
      // config must never be reused.
      command: "pnpm dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Chat assertions read the indexer, so the run owns its lifecycle.
      // `:memory:` guarantees a fresh cursor at the current finalized head;
      // otherwise a stale file cursor would replay thousands of blocks.
      command: "pnpm indexer:dev",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        INDEXER_RPC_URL:
          process.env.INDEXER_RPC_URL ?? "https://test.rpc.fastnear.com",
        // Fall back to the deployed manifest so `--list` and non-governance
        // runs do not require the env var just to boot the indexer.
        GROUPVAULT_CONTRACT_ID:
          process.env.NEXT_PUBLIC_GROUPVAULT_CONTRACT ??
          process.env.GROUPVAULT_CONTRACT_ID ??
          "gv-deployer-1024-204559-groupvault.testnet",
        INDEXER_DB_PATH: ":memory:",
        INDEXER_INITIAL_BACKFILL_BLOCKS: "0",
        INDEXER_POLL_INTERVAL_MS: "1500",
      },
    },
  ],
})
