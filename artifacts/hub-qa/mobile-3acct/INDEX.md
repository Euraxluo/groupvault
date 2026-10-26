# Mobile 3-account storyboard

Updated: 2026-10-26 ~13:28 Asia/Shanghai

## Accounts
- **A:** `gv-a-1024-210252.testnet` (~2.98N after Convert+Transfer bond cycle)
- **B:** `gv-b-1024-210252.testnet` (~0.95N after +0.5N Transfer payout)
- **C:** `gv-topup-mvmi9vo1.testnet` (topped +0.25N from A)

## Group 16 (`Mobile3 sxqh5`) — fresh create @ frames 74+
- **members (3):** A, B, C — on-chain PASS
- **dao_id:** `gv16-8jh4.sputnikv2.testnet` — Convert PASS with **10 NEAR** deposit
- **Governance:** RoleWeight council; **Transfer #0 Approved** (0.5N → B); votes A+B Approve; DAO 6.0→5.5N
- Live GroupVault contract still enforces **10N** `CONVERT_DEPOSIT` (source `6cec97d` lowered TS/Rust to 5N but **was not redeployed**). UI deposit restored to 10N to match live.
- Prior g14 (`gv14-nkum44`) + g15 (`gv15-nvpuwx`) DAO accounts deleted earlier; group rows still show stale dao_id strings.

## RPC / services
- Primary browser RPC: `https://testnet-rpc.intea.rs` (FastNear primary was 429)
- Failover kept: Intea → FastNear alt → FastNear → near.org (`lib/near/rpc.ts` local patch)
- demo `http://127.0.0.1:3100` UP(200); indexer `:8787` ready=true but RPC note 422 / cursor lag

## Viewport
- 390×844 · isMobile · hasTouch · `fullPage: false`

## Frames create/convert beat (74–102)

| Frame | Shot |
| --- | --- |
| 74 | A-home |
| 75 | A-create-form |
| 76 | A-overview (Loading group… under RPC lag) |
| 77–78 | A-chat / no-composer (RPC membership lag) |
| 79–81 | B-home / join / join-result (**join PASS**) |
| 82–83 | B-chat / no-composer (lag) |
| 84–86 | C-home / join / join-result (**join PASS**) |
| 87–88 | C-chat / no-composer (lag) |
| 89–91 | A-convert first try — **FAIL** ERR_CONVERT_DEPOSIT @5N |
| 92–93 | A-chat-ready / chat-sent (**chat PASS** optimistic) |
| 94–95 | B-chat-ready / chat-sent (**chat PASS**) |
| 96–97 | C-chat-ready / chat-sent (**chat PASS**) |
| 98–100 | A-convert @10N / submitted / final **Converted** |
| 101 | A-chat-post-convert |
| 102 | A-dao-hub (`gv16-8jh4…`) |

Older frames 00–49 (and overnight 50–73 evidence noted in STATUS/WORKLOG) remain on disk where present.

## Frames governance beat (103–113) — next=114

| Frame | Shot |
| --- | --- |
| 103 | A-dao-hub |
| 104 | A-treasury |
| 105 | A-transfer-form |
| 106 | A-transfer-submitted (proposal #0) |
| 107 | A-proposal InProgress |
| 108 | A-voted |
| 109 | B-proposal |
| 110 | B-voted |
| 111 | A-proposal-final **Approved** |
| 112 | A-dao-after |
| 113 | A-chat-post-gov |

## Scripts
- `scripts/mobile-3acct-from74.mjs` — create/join/convert attempt
- `scripts/mobile-3acct-resume92.mjs` — chat + Convert@10N resume
- `scripts/mobile-3acct-gov103.mjs` — RoleWeight Transfer propose + A/B approve

## Review
See `REVIEW.md`.
