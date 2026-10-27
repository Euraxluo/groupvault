# Mobile 3-account storyboard

Updated: 2026-10-27 ~15:30 Asia/Shanghai

## Accounts
- **A:** `gv-a-1024-210252.testnet` (~0.67N after TokenWeight beat)
- **B:** `gv-b-1024-210252.testnet` (~0.30N)
- **C:** `gv-topup-mvmi9vo1.testnet` (~0.20N)

## Group 16 (`Mobile3 sxqh5`)
- **members (3):** A, B, C
- **dao_id:** `gv16-8jh4.sputnikv2.testnet`
- **Convert:** PASS @10N (frames 74–102)
- **RoleWeight Transfer #0:** Approved 0.5N→B (frames 103–113)
- **TokenWeight beat (114–129):**
  - New staking: `staking.gv-a-1024-210252.testnet` (shared `sputnikstaking.gv-deployer-…` owned by groupvault-13 — cannot reuse)
  - SetStaking **#2** Approved
  - TokenWeight policy **#3** Approved
  - A delegation **2000000**
  - B zero-weight reject PASS
  - TokenWeight Transfer **#4** Approved 0.1N→B (vote_counts council weight 2000000)
- Live CONVERT_DEPOSIT still **10N** (source 5N not redeployed)

## RPC / services
- Primary: `https://testnet-rpc.intea.rs` (+ failover patch)
- demo `:3100` UP; indexer `:8787` ready but RPC lag / 422

## Viewport
- 390×844 · isMobile · hasTouch · `fullPage: false`

## Frames create/convert (74–102)
| Frame | Shot |
| --- | --- |
| 74–102 | create → join → chat → Convert@10N → dao hub (see prior INDEX detail) |

## Frames RoleWeight Transfer (103–113) — next was 114
| Frame | Shot |
| --- | --- |
| 103–113 | treasury Transfer#0 → A+B approve → Approved |

## Frames TokenWeight (114–129)
| Frame | Shot |
| --- | --- |
| 114 | A-dao-start |
| 115–119 | fund#1 attempt (3.2N) → later **Rejected** (DAO storage floor) |
| 120 | A-dao-resume |
| 121–122 | staking setup / SetStaking form |
| 123 | A-setstaking-result (**#2 Approved**) |
| 124 | A-tokenweight-result (**#3 Approved**) |
| 125 | A-stake-done (delegation=2000000) |
| 126–127 | B zero-weight before/reject |
| 128 | A-tw-transfer-final (**#4 Approved**) |
| 129 | A-dao-final |

## Scripts
- `scripts/mobile-3acct-from74.mjs` / `resume92.mjs` / `gov103.mjs` / `mobile-3acct-tw114.mjs`

## Review
See `REVIEW.md`.

## Frames wrap130 (130–152) — Tip soft-FAIL then fixed @153
| Frame | Shot |
| --- | --- |
| 130 | A-discover |
| 131 | A-groups |
| 132 | A-g16-overview |
| 133–134 | A/B g16-roster (Details only — Tip not yet visible) |
| 135–136 | A chat / QR |
| 137–140 | inbox / dao / stake / staking-setup |
| 141–146 | treasury / proposals / Transfer#5 open→B zero→final **Approved** |
| 147 | A-roster-tip-ui (Details; Tip missing — soft-FAIL) |
| 148–152 | chat wrap / C home+chat+QR / A dao end |

## Frames Tip UI fix (153–155) — **next=156**
| Frame | Shot |
| --- | --- |
| 153 | A-g16-details-tip-visible — inline 成员·打赏; Tip for B/C |
| 154 | A-tip-after-click — tx shown; B +0.01N |
| 155 | A-roster-full-tip — full roster Tip count=2 |

## Scripts
- `scripts/mobile-3acct-from74.mjs` / `resume92.mjs` / `gov103.mjs` / `mobile-3acct-tw114.mjs` / `mobile-3acct-wrap130.mjs` / `mobile-3acct-tip153.mjs`

## Review
See `REVIEW.md`.
