# Real-wallet E2E

These tests drive the copied Next UI with two manually prepared Chromium profiles.
They never mock a wallet, approve on the user's behalf, or keep a key.

## Prerequisites

```bash
pnpm exec playwright install chromium
```

1. Start the indexer and web app:

   ```bash
   pnpm indexer:dev
   pnpm dev -- --hostname 127.0.0.1 --port 3000
   ```

2. Connect account A in the first persistent profile and account B in the
   second. Funds:
   - A: NEAR for create/Convert/DAO work
   - B: join fee + gas

3. Set the public IDs for the run:

   ```bash
   export DEMO_ACCOUNT_A=<a.testnet>
   export DEMO_ACCOUNT_B=<b.testnet>
   export DEMO_RECEIVER=<public receiver.testnet>
   export NEXT_PUBLIC_GROUPVAULT_CONTRACT=$(jq -r .groupvault_account_id deployments/testnet.json)
   export NEXT_PUBLIC_JOIN_FT=$(jq -r .join_ft_account_id deployments/testnet.json)
   export DEMO_PHASE=through-convert
   ```

4. Create `artifacts/demo-input.json` with `{}` before the first run. The suite
   fills only public values as steps complete.

## Run

```bash
PLAYWRIGHT_PROFILE_A="$PWD/.runtime/wallet-a" \
PLAYWRIGHT_PROFILE_B="$PWD/.runtime/wallet-b" \
  pnpm e2e:testnet -- --project=chromium tests/e2e/demo.spec.ts
```

Each wallet action pauses up to three minutes for approval. A rejection or
timeout fails the run; it is never marked skipped or verified.

## Evidence

`artifacts/demo-input.json` contains only public account IDs, group/DAO IDs,
amounts, and transaction hashes. It never contains a key or seed phrase.
