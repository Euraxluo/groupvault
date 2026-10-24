#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
WASM="$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_contract.wasm"
TOKEN_WASM="$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_test_token.wasm"

rustup target add wasm32-unknown-unknown >/dev/null

cargo build \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-contract \
  --target wasm32-unknown-unknown \
  --release

cargo build \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-test-token \
  --target wasm32-unknown-unknown \
  --release

cargo build \
  --manifest-path "$CONTRACTS/Cargo.toml" \
  --package groupvault-test-factory \
  --target wasm32-unknown-unknown \
  --release

test -s "$WASM"
test -s "$TOKEN_WASM"
echo "wasm: $WASM"
shasum -a 256 "$WASM"
echo "token wasm: $TOKEN_WASM"
shasum -a 256 "$TOKEN_WASM"
echo "factory wasm: $CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_test_factory.wasm"

cd "$CONTRACTS"
cargo test --workspace --lib

GROUPVAULT_WASM="$WASM" \
GROUPVAULT_TOKEN_WASM="$TOKEN_WASM" \
GROUPVAULT_FACTORY_WASM="$CONTRACTS/target/wasm32-unknown-unknown/release/groupvault_test_factory.wasm" \
cargo test \
  --package groupvault-contract \
  --test create_group \
  --test views \
  --test join_fee \
  --test join_fee_refund \
  --test withdraw_fees \
  --test chat \
  --test chat_limits \
  --test convert \
  --test convert_failure \
  --test convert_race
