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

## Continuation 2026-10-26 14:51 CST — wrap130 (frames 130–152)

| Step | Verdict | Notes |
| --- | --- | --- |
| Transfer #5 | **PASS** | Approved (TokenWeight); frames 144–146 |
| tipAB on-chain | **PASS** | 0.01N A→B via near-api (not UI) |
| Tip UI | **soft-FAIL** | frame 147 Details only; Tip buried in nested Roster |
| chatWrap | **PASS** | frame 148 |
| mobile01CanClose | true (acceptance met; Tip UI deferred) |

## Continuation 2026-10-27 15:25 CST — Tip UI fix (frames 153–155)

| Step | Verdict | Notes |
| --- | --- | --- |
| Root cause | Details → Roster nesting; Tip only in Members dialog; scripts stopped at Details; nested Dialog same z-50 |
| Product fix | Inline 成员·打赏 + Tip/打赏 in Details; Roster closes Details then opens full list; Chinese copy |
| Tip UI | **PASS** | frame 153: Tip visible for B/C; self=自己 disabled |
| Tip click | **PASS** | frame 154: tx B2QCabYz…; B +0.01N |
| Full roster Tip | **PASS** | frame 155 count=2 |
| MOBILE-01 | **可关 / 完成** | mobile01CanClose=true; Tip PASS |

### Kept
- rpc.ts failover + 网络繁忙 page patch
- CONVERT_DEPOSIT live 10N
- Jobs IA bottom-nav **not** restored
- No original multisig / DeepSeek / force-push

## Continuation 2026-10-29 12:25 CST — Jobs Mobile IA (frames 156–162)

Viewport 390×844 / DPR2 · live `:3100` · hub-managed dev server (never restarted by the driver).

| Frame | Verdict | Notes |
| --- | --- | --- |
| 156 消息 | **PASS** | 19 bounded real groups, honest "尚未按成员关系过滤", `入群费 1 入群币`, zero raw base units/yocto |
| 157 发现 | **PASS** | group-16 row links to `/groups/16/join` (paid wall), no `/chat` shortcut |
| 158 群 16 聊天 | **PASS** | 群名 + DAO 徽标 + `群`; compact Chinese privacy copy |
| 159 群概况 | **PASS** | 3 members, `1 入群币`, 已是 DAO; self `自己` disabled, B/C `打赏`; **no Tip tx** |
| 160 升级确认 | **PASS** | genuine A-owned unconverted fixture **group 17**; `约 10 NEAR`; enabled 确认升级; **not clicked** (`convert_tx` absent) |
| 161 金库一眼 | **PASS** | chain balance `6.3501 NEAR` (read via `NearRpc.accountBalance`), sole primary `回到聊天` |
| 162 回到聊天 | **PASS** | final URL `…/groups/16/chat`, composer available (membership confirmed) |

### Preservation
- 153–155 SHA-256 recorded before capture and unchanged (`git diff --exit-code` clean).
- `lib/near/rpc.ts` failover + `网络繁忙` kept; `CONVERT_DEPOSIT` 10N unchanged.
- Secondary capability trace re-checked this round: sheet → `/dao/:id` → treasury / proposals / staking setup / stake; Join, Roster, QR all reachable; `/inbox` is a redirect, not a capability entry.

### Honest gaps
- `:8787` indexer remains frozen (`last_processed_block 274620987`, `RPC block failed with HTTP 422`), so chat frames show the real "索引器同步中" state and `jobs-ia-e2e-result.json` stays **partial** even though the message is proven in chain logs.
- J019's fresh journey (group 18) is chain-verified; its `indexed_message` gap is the same indexer issue, not a UI defect.

### Defects found and fixed during this round
| Symptom | Fix |
| --- | --- |
| Chat told a **member** "付费进群后才能发言" while membership was still loading | `GroupChat` renders `正在确认你的成员身份…` until the member list arrives (`loading && members.length===0`) |
| Proposals page parsed empty `?ids=` as proposal **0** | drop empty tokens before numeric parsing |
| Proposal list discarded all reads when one of ten `get_proposal` calls 429'd | bounded 3-wide read, newest-first, partial results + explicit `N 个提案读取失败` |
| Sheet/Treasury frames captured mid-animation | driver waits for dialog geometry / text to settle |
