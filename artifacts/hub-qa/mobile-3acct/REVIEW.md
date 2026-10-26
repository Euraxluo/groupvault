# Mobile Web3 UX review — hub-qa/mobile-3acct (continuation)

Viewport: **390×844** · `fullPage: false` · Asia/Shanghai **2026-10-26 ~13:23**.

## Chain critical path (group 16)

| Step | Verdict | Evidence |
| --- | --- | --- |
| A balance ≥ convert | **PASS** | ~12.99N before (after B/C top-up) |
| A create group | **PASS** | group **16** `Mobile3 sxqh5` |
| B join | **PASS** | members include B (frame 81 + `get_members`) |
| C join | **PASS** | members=3 (frame 86 + chain) |
| A/B/C chat send | **PASS** | frames 93/95/97 optimistic “sent · waiting for indexer” |
| Convert @5N | **FAIL** | frame 90 `ERR_CONVERT_DEPOSIT` — live contract still 10N |
| Convert @10N | **PASS** | `dao_id=gv16-8jh4.sputnikv2.testnet` frames 100–102 |
| Indexer message finality | soft-FAIL | indexer ready but cursor lag / RPC 422 — UI honest pending label |

## UX notes
- Early chat frames (77–88) showed **Join to send** / “Group unavailable” while RPC membership lag — **not** a membership bug (chain already had A owner; B/C joined). Resume with Intea primary fixed composer.
- Convert success UI shows green **Converted** + Open DAO setup (frame 100).
- DAO hub (102) loads id correctly; Vote policy / staking still “Loading…” under RPC — layout PASS, data soft-FAIL.
- Did **not** reintroduce Jobs IA bottom-nav redesign.

## Fixes this beat
| Issue | Fix |
| --- | --- |
| Convert 5N vs live 10N | `lib/near/deposits.ts` CONVERT_DEPOSIT → 10N (match live until redeploy) |
| FastNear 429 in browser | `.env.local` primary → Intea; keep rpc.ts failover patch |
| B/C gas starvation | A sent +0.4N B, +0.25N C before joins |

## Kept local patches (uncommitted intent)
- `lib/near/rpc.ts` FastNear→Intea→FastNear alt→near.org + Failed to fetch rotation
- `app/groups/[groupId]/page.tsx` 网络繁忙 vs Group not found

## Next
- Frame **103+**: post-convert TokenWeight / Transfer story on `gv16-8jh4`, or recover indexer cursor.
- Optional: redeploy GroupVault wasm so on-chain CONVERT_DEPOSIT matches source 5N, then lower TS again.
