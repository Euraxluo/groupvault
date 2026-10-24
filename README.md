# GroupVault

GroupVault is a NEAR testnet demo for paid NEP-141 groups that convert into a
Sputnik DAO with one owner signature. Chat messages are public plaintext logs;
membership does not grant voting weight.

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
The testnet deploy and indexer scripts are added by their owning tasks so that
no command can report a fake success before the implementation exists.

## Product invariants

- Convert is exactly one wallet signature to GroupVault, then Sputnik
  `factory.create`; `dao_id` is written only after a successful boolean callback.
- Join payment is one `ft_transfer_call`; every failure returns the full unused
  token amount and creates no membership.
- Group chat is public `env::log_str` data plus an indexer. There is no E2E
  privacy claim and there is no server signer.
- Staking the same join FT is the only source of TokenWeight.
- GroupVault never holds user keys and never signs a user product action.

## Documentation

- Planning source: `/Users/echo/project/groupvault-docs/plans/`
- Task board: `/Users/echo/project/groupvault-docs/plans/TASKS.md`
- Frontend pin: `/Users/echo/project/groupvault-docs/orchestration/frontend-copy-pin.txt`
