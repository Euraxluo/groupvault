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

## Continuation 2026-10-26 13:28 CST — governance Transfer #0

| Step | Verdict | Notes |
| --- | --- | --- |
| Policy RoleWeight | **PASS** | threshold [1,2]; council A/B/C; staking unset (TokenWeight path not required this beat) |
| A Add Transfer #0 | **PASS** | UI `add_proposal`; 0.5N native → B; bond 1N |
| A VoteApprove | **PASS** | still InProgress (need ≥2 council with 1/2 of 3 → ceil path needed 2) |
| B VoteApprove | **PASS** | status → **Approved**; vote_counts council [2,0,0] |
| Payout | **PASS** | DAO −0.5N (6.0→5.5); B +≈0.5N (0.45→0.95) |
| Frames 103–113 | **PASS** | phone 390×844; chat-first frame 113 after gov |

### Honest soft notes
- Did **not** run SetStakingContract / TokenWeight / stake this beat (A≈2.98N; RoleWeight sufficient for Transfer proof).
- Indexer still lagging (RPC 422) — unrelated to Transfer finality (on-chain Approved).
- Jobs IA bottom-nav not restored.

## Continuation 2026-10-26 14:30 CST — TokenWeight beat

| Step | Verdict | Notes |
| --- | --- | --- |
| Reuse shared sputnikstaking | **BLOCKED** | STATE owner=`groupvault-13.sputnikv2.testnet` |
| Fund A 3.2N from DAO (#1) | **FAIL→Rejected** | Execute would leave DAO below storage floor (~need +2.11N); B+C VoteReject |
| Deploy `staking.gv-a-1024-210252.testnet` | **PASS** | owner=gv16, token=join FT; ~2.2N wasm storage |
| SetStaking #2 | **PASS** | B+C Approve (A gas-starved); `get_staking_contract` set |
| TokenWeight #3 | **PASS** | B+C Approve; policy TokenWeight [1,2] |
| A stake/delegate | **PASS** | Need FT `storage_deposit` for staking account first; delegation=2000000 |
| B zero-weight | **PASS** | UI “Zero voting weight” (frame 127) |
| Transfer #4 0.1N→B | **PASS** | A VoteApprove with stake weight; DAO 6.5→6.4N |

### Soft / ops
- DAO treasury tightly storage-locked after Convert; large native Transfers out fail.
- Proposal bond 1N + staking deploy drained A; B/C topped gas.
- Indexer still lagging — Transfer finality is on-chain Approved.
- Jobs IA not restored.
