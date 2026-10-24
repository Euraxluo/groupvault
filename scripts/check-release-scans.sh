#!/usr/bin/env bash
# Release content guards. Patterns are defined here so documentation and
# evidence can describe the rules without matching them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SECRET_PATTERN='ed25519:|BEGIN .*PRIVATE|PRIVATE_KEY=|TODO_ACCOUNT|chatme\.near'
STACK_PATTERN='@mysten/|@sui-universal|FROST|DKG|VSS|Walrus|SEAL'

if rg -n "$SECRET_PATTERN" deployments artifacts docs README.md .env.example; then
  echo "secret/credential placeholder found in shipped files" >&2
  exit 1
fi

if rg -n "$STACK_PATTERN" app components hooks lib/near contracts/groupvault/src; then
  echo "retired or excluded stack reference found in the product surface" >&2
  exit 1
fi

echo "release scans clean"
