# GroupVault E2E (testnet)

These tests drive the Next UI against live testnet contracts. Prefer **demo
keypair signing** for unattended create→join→chat→Convert. MyNearWallet with
headed human approval remains available when no demo keys are configured.

## Prerequisites

```bash
pnpm exec playwright install chromium
```

1. Ensure contract env is set (see `.env.local` / `.env.local.example`).
   `playwright.e2e.config.ts` starts **both** the Next dev server and the
   indexer for the run, so do not keep your own listener on `:3100`/`:8787`.
2. Funded A/B accounts with credentials in `~/.near-credentials/testnet/` or
   exported as `DEMO_PRIVATE_KEY_A` / `DEMO_PRIVATE_KEY_B`.

## Keypair mode (recommended for T011)

Keys are read in the Playwright process from env or `~/.near-credentials` and
injected into the page (`window.__GV_KEYPAIR__` + Connect → Keypair demo).
Nothing is committed to git.

```bash
cd /Users/echo/project/groupvault
export DEMO_ACCOUNT_A=gv-a-1024-210252.testnet
export DEMO_ACCOUNT_B=gv-b-1024-210252.testnet
export DEMO_RECEIVER=gv-b-1024-210252.testnet
export DEMO_KEYPAIR_MODE=1
# Optional if credentials are not in ~/.near-credentials:
# export DEMO_PRIVATE_KEY_A=<local keypair string>
# export DEMO_PRIVATE_KEY_B=<local keypair string>
export NEXT_PUBLIC_GROUPVAULT_CONTRACT=gv-deployer-1024-204559-groupvault.testnet
export NEXT_PUBLIC_JOIN_FT=gv-deployer-1024-204559-ft.testnet
export NEXT_PUBLIC_NEAR_NETWORK=testnet
export NEXT_PUBLIC_NEAR_RPC_URL=https://test.rpc.fastnear.com
export NEXT_PUBLIC_FACTORY=sputnikv2.testnet
export NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8787
export DEMO_PHASE=through-convert

pnpm e2e:testnet -- --project=chromium tests/e2e/demo.spec.ts
```

When keypair mode is active, `waitForWalletApproval` does **not** pause for a
human extension click.

The indexer is started by Playwright with `INDEXER_DB_PATH=:memory:` so every
run begins at the current finalized head. Chat is asserted twice: the rendered
message inside the message list, and the indexer's `/messages` API for the same
group id, sender, and text. Asserting page text alone is not enough because the
textarea still contains the text that was just sent.

Point `INDEXER_RPC_URL` at a dedicated provider for repeated runs. The public
`test.rpc.fastnear.com` endpoint throttles full-window block scans with HTTP 429,
so a first run against it can spend up to a few minutes catching up.

## MyNearWallet (manual)

Omit `DEMO_KEYPAIR_MODE` / private key env so the driver falls back to headed
MyNearWallet approval (up to three minutes per step).

## Evidence

`artifacts/demo-input.json` contains only public account IDs, group/DAO IDs,
amounts, and transaction hashes. It never contains a key or seed phrase.

The create step starts from a clean record (`resetEvidence`), so a previous
run's `dao_id` or hashes can never be attributed to a new group. Each later step
adds only the values it produced: `join_tx`, `message_receipt_ids`,
`convert_tx`, then the chain-confirmed `dao_id`.

## Jobs IA journey (J018/J019)

`tests/e2e/jobs-ia.spec.ts` is the isolated Jobs IA run: A creates a fresh
group → B pays from 发现 → A chats and the indexer renders it → A converts →
DAO treasury glance → `回到聊天`.

- Evidence: `JOBS_IA_EVIDENCE_PATH` (default `artifacts/jobs-ia-e2e.json`) plus
  the independent final reads written to `artifacts/jobs-ia-e2e-result.json`.
  It refuses to point at `artifacts/demo-input.json`, so the older demo record
  can never be reused as this run's proof.
- B always runs in a separate `browser.newContext()`, so A's keypair session is
  never inherited by the paying account.
- Servers: the demo app on `:3100` and the indexer on `:8787` are usually
  hub-managed here, so the Playwright config reuses a live pair by default.
  Set `E2E_OWN_SERVERS=1` only on a machine where nothing is listening and you
  want the run to spawn fresh processes.
- Usage:

```bash
cd /Users/echo/project/groupvault
DEMO_PHASE=through-convert pnpm e2e:testnet --project=chromium \
  tests/e2e/jobs-ia.spec.ts --list
```

Note the direct `--project=...` form: an extra `--` makes Playwright treat the
following arguments as file filters and it will run every spec.
