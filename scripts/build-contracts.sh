#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
OUT="$ROOT/artifacts/wasm"

mkdir -p "$OUT"
rustup target add wasm32-unknown-unknown >/dev/null

cargo build \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-contract \
  --package groupvault-test-token \
  --target wasm32-unknown-unknown \
  --release

cp "$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_contract.wasm" \
  "$OUT/groupvault_contract.wasm"
cp "$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_test_token.wasm" \
  "$OUT/groupvault_join_ft.wasm"

shasum -a 256 "$OUT"/*.wasm | tee "$OUT/SHA256SUMS.txt"
