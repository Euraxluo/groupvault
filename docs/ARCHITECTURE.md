# GroupVault Architecture

## Runtime boundaries

```text
Browser (copied Next.js shell)
  ├─ @near-wallet-selector ........ user signature boundary only
  ├─ lib/near/* .................. RPC views and transaction assembly
  └─ indexer HTTP ................ public message history
        │
NEAR testnet
  ├─ GroupVault .................. groups, membership, join fees, chat logs, Convert
  ├─ NEP-141 join FT ............. paid join and later staking token
  ├─ sputnikv2 factory ........... creates {name}.sputnikv2.testnet
  ├─ Sputnik DAO ................. treasury, proposals, votes, TokenWeight
  └─ Sputnik staking ............. weight from the same join FT

Off-chain indexer
  ├─ finalized block cursor ...... bounded polling
  ├─ SQLite single writer ........ messages + processed blocks + meta
  └─ GET /messages ............... paginated public log projection
```

## Trust boundaries

| Component | Trust role |
| --- | --- |
| Wallet selector | The only user key holder and signer |
| GroupVault | Group state, fee accounting, log emission, one Convert cross-call |
| Sputnik | DAO treasury, policy, proposals, votes |
| Staking | Voting weight source for TokenWeight |
| Indexer | Untrusted projection; anyone can run it and it never signs |

The app has no server signer, keystore route, seed storage, or sponsored
transaction path.

## Convert sequence

1. Owner signs `convert_to_dao` with at least 10 NEAR.
2. GroupVault validates owner, `dao_id == null`, and `convert_pending == false`.
3. GroupVault sets `convert_pending = true` and snapshots at most 50 members.
4. GroupVault calls `sputnikv2.testnet.create` with a base64 policy payload and
   exactly 10 NEAR.
5. The private callback requires a successful promise and factory boolean
   `true`; only then writes `dao_id`.
6. A false/failed/malformed result clears pending and leaves `dao_id = null`,
   so the owner may retry.

Join-fee balances never leave GroupVault during Convert.

## Indexer guarantees

- Polls `final` blocks only, from the persisted cursor.
- One SQLite transaction commits a block's messages and the new cursor.
- `(receipt_id, log_index)` is unique, so replay is idempotent.
- Malformed or non-GroupVault logs are ignored rather than fatal.
- `/health` exposes readiness, the finalized head, the processed cursor, and
  cursor age. `/messages?group_id=..&cursor=..` returns
  `{items, next_cursor}` with a maximum page of 50.
- A late start cannot claim history before its selected start block.

## Production gaps (not P0)

- No E2E message encryption; all chat text is public.
- No archive/backfill beyond the configured start block.
- No multi-writer indexer or hosted SLA.
