#!/usr/bin/env bash
# Build the official Sputnik staking contract from the pinned commit and record
# its checksum. T012 requires commit + WASM hash to be pinned; the wasm is a
# build artifact and the upstream tree stays under the ignored vendor/ directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT="5434a59dec23ee0c49df8c8c4350c208a7e75b0b"
REPO="https://github.com/near-daos/sputnik-dao-contract.git"
VENDOR="$ROOT/vendor/sputnik-dao-contract"
OUT="$ROOT/artifacts/wasm/sputnik_staking.wasm"
MANIFEST="$ROOT/deployments/staking-source.json"

if [ ! -d "$VENDOR/.git" ]; then
  mkdir -p "$ROOT/vendor"
  git clone --depth 1 "$REPO" "$VENDOR"
fi

git -C "$VENDOR" fetch --depth 1 origin "$COMMIT"
git -C "$VENDOR" checkout --quiet FETCH_HEAD
actual="$(git -C "$VENDOR" rev-parse HEAD)"
if [ "$actual" != "$COMMIT" ]; then
  echo "staking source is at $actual, expected $COMMIT" >&2
  exit 1
fi

rustup target add wasm32-unknown-unknown >/dev/null
cargo build \
  --manifest-path "$VENDOR/Cargo.toml" \
  --package sputnik-staking \
  --target wasm32-unknown-unknown \
  --release

mkdir -p "$(dirname "$OUT")"
cp "$VENDOR/target/wasm32-unknown-unknown/release/sputnik_staking.wasm" "$OUT"
SHA="$(shasum -a 256 "$OUT" | awk '{print $1}')"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

node - "$MANIFEST" "$COMMIT" "$SHA" "$BUILT_AT" <<'NODE'
const { writeFileSync } = require("node:fs")
const [path, commit, sha, builtAt] = process.argv.slice(2)
writeFileSync(
  path,
  `${JSON.stringify(
    {
      commit,
      repository: "https://github.com/near-daos/sputnik-dao-contract",
      crate: "sputnik-staking",
      build:
        "cargo build -p sputnik-staking --target wasm32-unknown-unknown --release (rust 1.86)",
      wasm_path: "artifacts/wasm/sputnik_staking.wasm",
      wasm_sha256: sha,
      built_at: builtAt,
    },
    null,
    2,
  )}\n`,
)
NODE

echo "staking wasm: $OUT"
echo "sha256: $SHA"
echo "source commit: $COMMIT"
