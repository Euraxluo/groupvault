#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
WASM="$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_contract.wasm"

rustup target add wasm32-unknown-unknown >/dev/null

cargo build \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-contract \
  --target wasm32-unknown-unknown \
  --release

test -s "$WASM"
echo "wasm: $WASM"
shasum -a 256 "$WASM"

cargo test --manifest-path "$CONTRACTS/Cargo.toml" --workspace

GROUPVAULT_WASM="$WASM" cargo test \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-contract \
  --test create_group \
  --test views
