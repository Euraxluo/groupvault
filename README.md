# GroupVault

GroupVault is a NEAR testnet demo for paid NEP-141 groups that convert into a
Sputnik DAO with one owner signature. Chat messages are public plaintext logs;
membership does not grant voting weight.

Public repository: https://github.com/Euraxluo/groupvault

The frontend is a clean archive of the existing Next.js multisig shell, pinned
at `ddb4ac2051ee0a3d931b2e0d69b8ba15d46c954a`. All GroupVault work happens in
this repository, never in the source checkout.

## Stack

- Next.js 15.2.4, React 19, TypeScript, Tailwind and the copied Radix/shadcn UI
- Rust + `near-sdk` GroupVault contract (T003 onward)
- Finality-aware TypeScript indexer with SQLite (T006)
- `near-workspaces-rs` sandbox tests for FT callbacks and Convert
- NEAR testnet only

## Prerequisites

- Node 22 (`.nvmrc`), pnpm 12.9.1 through Corepack
- Rust with the `wasm32-unknown-unknown` target
- NEAR CLI only when a deployment task explicitly requires it

## Local commands

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm dev -- --hostname 127.0.0.1 --port 3000
```

`pnpm test:web` is the Playwright entry point reserved for the browser flows.
The indexer runs with `pnpm indexer:dev` (or `pnpm indexer:build` for the
compiled server). Testnet deploy scripts are added by their owning task so that
no command can report a fake success before the implementation exists.

## Indexer

```bash
pnpm --dir indexer install --frozen-lockfile
GROUPVAULT_CONTRACT_ID=<groupvault.testnet> \
INDEXER_START_BLOCK=0 \
INDEXER_DB_PATH=./data/messages.sqlite \
INDEXER_PORT=8787 \
  pnpm indexer:dev
```

`INDEXER_START_BLOCK=0` (or an empty value) resolves the current finalized head
once; it never scans from genesis. Set `INDEXER_INITIAL_BACKFILL_BLOCKS` for a
bounded lookback. The cursor and messages commit in one SQLite transaction, so
a restart resumes from the last committed block and replayed receipts stay
idempotent on `(receipt_id, log_index)`.

The indexer reads receipts through `tx` results: NEAR's `chunk` responses do not
include execution logs. It skips shards whose `tx_root` is the empty root and
fetches a small window of blocks concurrently, so its throughput stays at or
above testnet block production. On a public RPC this still hits HTTP 429 under
load; `INDEXER_RPC_URL` should point at a dedicated provider for long runs.

## Product invariants

- Joining requires payment in the group's designated NEP-141 fungible token.
  The demo join fee is one whole join token (1,000,000 base units at six
  decimals); it is not a NEAR native-token payment.
- Convert is exactly one wallet signature to GroupVault, then Sputnik
  `factory.create` through the official factory `sputnikv2.testnet`. The real
  factory's `create` returns unit and only its own
  callback returns a boolean, so an empty success payload is treated as
  accepted while any non-empty payload must still be explicit JSON `true`.
  `dao_id` is written only in that private callback.
- Join payment is one `ft_transfer_call`; every failure returns the full unused
  token amount and creates no membership.
- Group chat is public `env::log_str` data plus an indexer. There is no E2E
  privacy claim and there is no server signer.
- Staking the same join FT is the only source of TokenWeight.
- GroupVault never holds user keys and never signs a user product action.

## Demo and security status

GroupVault is an unaudited NEAR **testnet** hackathon demo, not a production
social or treasury product. The public walkthrough uses temporary testnet
accounts. The contract does not hold, escrow, or transmit user private keys.
Before Convert, the owner confirms that the real Sputnik factory deployment
requires approximately 10 NEAR. After conversion, DAO voting uses Sputnik
`TokenWeight`; that weight comes only from staking the same join FT through the
configured Sputnik staking contract. Paid membership alone never creates vote
weight.

The 60–90 second demo recording is prepared locally for the hackathon post and
is intentionally not committed when its file size adds no review value. The
underlying replayable evidence and rehearsal storyboard remain under
`artifacts/`.

## Documentation

- Local demo order (install → services → wallet → product path → e2e):
  `docs/DEMO-RUNBOOK.md`
- Deployment and pinned staking rebuild: `docs/TESTNET-DEPLOYMENT.md`
- Release gate and verification proof: `docs/RELEASE-CHECKLIST.md`
- Contracts, architecture and decisions: `docs/CONTRACT-INTERFACES.md`,
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
