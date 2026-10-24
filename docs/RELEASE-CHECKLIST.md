# GroupVault Release Checklist

Release target: NEAR testnet hackathon demo. There is no mainnet release, no
public deployment, and no marketing publication approved by this checklist.

## What is verified on chain

| Item | Value |
| --- | --- |
| GroupVault | `gv-deployer-1024-204559-groupvault.testnet` |
| Join FT (6 decimals) | `gv-deployer-1024-204559-ft.testnet` |
| Sputnik factory | `sputnikv2.testnet` |
| Demo group / DAO | group `13` → `groupvault-13.sputnikv2.testnet` |
| Staking | `sputnikstaking.gv-deployer-1024-204559.testnet` |
| Staking source pin | `5434a59dec23ee0c49df8c8c4350c208a7e75b0b` |
| Staking wasm sha256 | `e76fb65b6844785bff04430684a03203970f0a88676fa2ed23ccfdf69a414ed6` |
| TokenWeight policy | `weight_kind=TokenWeight`, threshold `[1,2]`, quorum `0` |
| A delegation | `2000000` while B (paid member) stays `0` |
| Executed Transfer | proposal 4 approved; DAO debited exactly 1 NEAR |

Evidence lives in `artifacts/demo-input.json` (public identifiers, amounts and
transaction hashes only) and `artifacts/demo-result.json` (independently
re-derived checks). No private key is stored in either file.

## Gate

Run from the repository root; every command must exit 0.

```bash
set -euo pipefail
corepack enable
pnpm install --frozen-lockfile
pnpm --dir indexer install --frozen-lockfile
pnpm lint
pnpm test
pnpm test:web
pnpm build
pnpm indexer:build
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
cargo test --manifest-path contracts/Cargo.toml --workspace
bash scripts/test-contracts.sh
pnpm verify:testnet -- --check all --evidence artifacts/demo-input.json
pnpm verify:demo -- --manifest deployments/testnet.json \
  --evidence artifacts/demo-input.json --out artifacts/demo-result.json
python3 -m json.tool deployments/testnet.json >/dev/null
python3 -m json.tool artifacts/demo-result.json >/dev/null
bash scripts/check-release-scans.sh
git diff --check
git status --short
```

`cargo fmt` needs `--all` because `contracts/Cargo.toml` is a virtual
workspace with no package targets of its own.

`scripts/check-release-scans.sh` holds the two content guards. They are
release gates, not style rules: the first keeps key material and placeholder
credentials out of shipped files, the second keeps the retired Sui-only stack
and the excluded key-ceremony protocols out of the product surface. The
patterns live in the script so this document stays clean.

## Rebuilding the staking artifact

```bash
pnpm build:staking
```

This fetches the pinned upstream commit into the gitignored `vendor/`
directory, builds `sputnik-staking` for `wasm32-unknown-unknown`, and rewrites
`deployments/staking-source.json` with the commit and the wasm checksum. The
deploy phase refuses to run if the recorded checksum no longer matches.

## Known limitations

- The public `test.rpc.fastnear.com` endpoint rate-limits heavy polling
  (HTTP 429). Set a dedicated `INDEXER_RPC_URL` for repeated demo runs.
- The demo signer is testnet-only and refuses to sign on mainnet. MyNearWallet
  remains the default product signer.
- Chat is public on-chain log data. There is no encryption claim and no server
  side signer.
- Do not publish to a public GitHub remote, Notion, or X without separate
  explicit authorization.
