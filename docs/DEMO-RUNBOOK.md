# GroupVault Demo Runbook

Status: base + join FT are live on NEAR testnet; create → join → chat → Convert
has been proven end-to-end by the Playwright journey (T011). Staking/Transfer
remain gated by T012-T013.

## Architecture reminder

- Create, join, chat, and Convert are signed by the user's NEAR wallet.
- The app never stores or transmits a user private key.
- Chat text is a public `env::log_str`; history comes from the local indexer.
- Convert is one owner signature to GroupVault, which calls Sputnik
  `factory.create`; `dao_id` appears only after the callback.

## 1. Install

```bash
cd /Users/echo/project/groupvault
corepack enable
pnpm install --frozen-lockfile
pnpm --dir indexer install --frozen-lockfile
cp .env.example .env.local
```

Fill only public values in `.env.local` after T010 writes the manifest:

```text
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_RPC_URL=https://test.rpc.fastnear.com
NEXT_PUBLIC_GROUPVAULT_CONTRACT=<from deployments/testnet.json>
NEXT_PUBLIC_JOIN_FT=<from deployments/testnet.json>
NEXT_PUBLIC_FACTORY=sputnikv2.testnet
NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8787
```

## 2. Local services

```bash
pnpm dev -- --hostname 127.0.0.1 --port 3000
```

Run the indexer separately, or let `pnpm e2e:testnet` own both services:

```bash
GROUPVAULT_CONTRACT_ID=<from deployments/testnet.json> \
INDEXER_RPC_URL=https://test.rpc.fastnear.com \
INDEXER_START_BLOCK=0 \
  pnpm indexer:dev
```

The indexer prints its listen URL. `curl http://127.0.0.1:8787/health` must show
`ready: true` once it has persisted the first finalized cursor.

## 3. Wallet sessions

1. Open Chromium profile A and connect MyNearWallet as account A.
2. In a second persistent Chromium profile, connect account B.
3. Never reuse the deployer account as A or B.

For unattended testnet runs, Connect → **Keypair (demo)** signs locally with an
`ed25519:` key held only in that tab's `sessionStorage`. The automated driver
injects credentials from `DEMO_PRIVATE_KEY_A/B` or `~/.near-credentials` and
never writes a key into the repo or evidence file. MyNearWallet remains the
default product path.

## 4. Product path

| Step | User | Expected evidence |
| --- | --- | --- |
| Create group | A | wallet approval, group ID parsed from the receipt, on-chain `get_group` |
| Paid join | B | one-yocto `ft_transfer_call`, `is_member(B) = true`, paid membership warning |
| Chat | A and B | one canonical public log per message, indexer eventually shows both |
| Convert | A | pending state, factory call, `dao_id` only after a true callback, DAO `get_policy` |
| Staking setup | A | DAO proposals executed, `get_staking_contract` equals the deployed staking |
| Stake | A | storage deposit, empty-msg FT transfer, delegate, delegation > 0 |
| Transfer | A | native Transfer proposal, exact-kind approval, receiver balance increase |

## 5. Failure and delay states

- Wallet rejection: show the wallet error and do not mark the step complete.
- Join refund: GroupVault returns the full amount; refresh membership from RPC.
- Convert failure: `dao_id` stays empty and `convert_pending` clears; retry is
  allowed from the same group.
- `sputnikv2.testnet.create` returns unit and only its own callback returns a
  boolean, so GroupVault treats an empty success payload as accepted while a
  non-empty payload must still be explicit JSON `true`. A malformed payload is
  still a failure.
- Indexer delay: show "indexing" rather than inventing messages.
- Chat is public; never type a secret into the composer.

## 6. Local test commands

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
bash scripts/test-contracts.sh
```

## 7. Unattended e2e (T011)

```bash
cd /Users/echo/project/groupvault
export DEMO_ACCOUNT_A=<account A>
export DEMO_ACCOUNT_B=<account B>
export DEMO_RECEIVER=<account B>
export DEMO_KEYPAIR_MODE=1
export DEMO_PHASE=through-convert
export NEXT_PUBLIC_GROUPVAULT_CONTRACT=<from deployments/testnet.json>
export NEXT_PUBLIC_JOIN_FT=<from deployments/testnet.json>
export NEXT_PUBLIC_NEAR_NETWORK=testnet
export NEXT_PUBLIC_NEAR_RPC_URL=https://test.rpc.fastnear.com
export NEXT_PUBLIC_FACTORY=sputnikv2.testnet
export NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8787

pnpm e2e:testnet -- --project=chromium tests/e2e/demo.spec.ts
```

Playwright starts the web app and the indexer and fails the run if any step did
not really happen. Chat is asserted against both the rendered message and the
indexer API. A requires ~10 NEAR for the Convert deposit plus gas; B needs the
join-FT balance.

Playwright requires a real wallet approval for testnet flows. A rejection or
timeout must fail the run; it must never be marked skipped or verified.
