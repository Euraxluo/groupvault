# GroupVault Demo Runbook

Status: local shell and adapters only. Live testnet steps are gated by T010-T013.

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
NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.testnet.near.org
NEXT_PUBLIC_GROUPVAULT_CONTRACT=<from deployments/testnet.json>
NEXT_PUBLIC_JOIN_FT=<from deployments/testnet.json>
NEXT_PUBLIC_FACTORY=sputnikv2.testnet
NEXT_PUBLIC_INDEXER_URL=http://127.0.0.1:8787
```

## 2. Local services

```bash
pnpm indexer:dev
pnpm dev -- --hostname 127.0.0.1 --port 3000
```

The indexer prints its listen URL. `curl http://127.0.0.1:8787/health` must show
`ready: true` once it has persisted the first finalized cursor.

## 3. Wallet sessions

1. Open Chromium profile A and connect MyNearWallet as account A.
2. In a second persistent Chromium profile, connect account B.
3. Never reuse the deployer account as A or B.

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

Playwright requires a real wallet approval for testnet flows. A rejection or
timeout must fail the run; it must never be marked skipped or verified.
