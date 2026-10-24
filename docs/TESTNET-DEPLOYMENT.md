# Testnet Deployment

Status: base GroupVault and join FT are deployed on NEAR testnet. Staking is
gated on the browser Convert producing a real `dao_id` (T011 → T012).

## Public identities

Read the live values from `deployments/testnet.json`; never hand-copy them into
code.

```bash
jq '{groupvault: .groupvault_account_id, ft: .join_ft_account_id, factory: .factory_id}' \
  deployments/testnet.json
```

## Credentials

Only deployer infrastructure credentials live in the NEAR CLI credential store
(`~/.near-credentials/testnet/`). They are never written to this repository,
`.env.local`, artifacts, or documentation.

A/B product wallets are separate. They sign in the browser through
`@near-wallet-selector`; the deployer never signs their create, join, chat,
Convert, staking, or vote actions.

## Build

```bash
rustup target add wasm32-unknown-unknown
bash scripts/build-contracts.sh
shasum -a 256 artifacts/wasm/*.wasm
```

`deployments/testnet.json` records the SHA256 of the exact wasm that was
deployed for GroupVault and the join FT.

## Deploy

```bash
# First run only: identify the funded account already present in NEAR CLI.
export NEAR_DEPLOYER_ACCOUNT=<deployer.testnet>

pnpm deploy:testnet -- --phase base
pnpm deploy:testnet -- --phase ft
pnpm verify:testnet -- --check base
```

Phases are idempotent: re-running against an initialized contract verifies
instead of re-initializing. The scripts create missing subaccounts through the
testnet faucet and fail on missing credentials rather than fabricating state.

The FT phase writes public `NEXT_PUBLIC_*` values to the ignored `.env.local`.

## Demo FT

The join token is a minimal NEP-141 fixture with 6 decimals. Minting is
deployer-only and exists only to provision demo balances:

```bash
near call <join_ft> mint \
  '{"account_id":"<demo-wallet>","amount":"<base-units>"}' \
  --accountId <deployer.testnet> --depositYocto 1
```

This is not a token sale and has no value.

## Staking

The staking phase resolves the DAO from GroupVault and refuses to run before a
real Convert:

```bash
GROUP_ID=$(jq -er '.group_id' artifacts/demo-input.json)
pnpm deploy:testnet -- --phase staking --group-id "$GROUP_ID"
pnpm verify:testnet -- --check staking --evidence artifacts/demo-input.json
```

It requires `deployments/staking-source.json` with the pinned upstream commit
and the built wasm checksum. A missing DAO, missing source record, or checksum
mismatch is a hard failure.

## Manual acceptance after deploy

```bash
pnpm verify:testnet -- --check base
pnpm exec next build
python3 -m json.tool deployments/testnet.json >/dev/null
```

The verifier reads final chain state directly; it does not trust the manifest's
labels.
