# Mobile 3-account storyboard

Generated: 2026-10-25 (Asia/Shanghai)

## Accounts
- **A (owner / Tab A):** `gv-a-1024-210252.testnet`
- **B (member1 / Tab B):** `gv-b-1024-210252.testnet`
- **C (member2 / Tab C):** `gv-topup-mvmi9vo1.testnet` (alias note in `~/.near-credentials/testnet/gv-c-mobile-3acct.testnet.json` if written)

## Group
- **Fresh group 14** (`Mobile3 5oip0`) — A created; B joined; C join blocked by RPC 429 after NEAR top-up
- **DAO visuals:** group **13** / `groupvault-13.sputnikv2.testnet` (frames 32–35) — already converted TokenWeight path from prior verified run
- Group 14 convert not confirmed on-chain this run (RPC)

## Viewport
- iPhone 14 · 390×844 · isMobile · hasTouch · deviceScaleFactor 2
- Screenshots: `fullPage: false` (phone frame only)

## Click path (real)
### OK
- A create_group → group 14
- A send_message
- A convert attempted (UI)
- B join → member
- B send
- C connect + join attempted
### Blocked
- A convert broadcast / C join confirm — fastnear **HTTP 429** (and C briefly under-funded before +0.25N top-up)

## Frames (34)
- `00-smoke-chat-disconnected.png`
- `00-smoke-home.png`
- `01-A-home.png`
- `02-A-groups.png`
- `03-A-create-form.png`
- `04-A-overview.png`
- `05-A-chat.png`
- `06-A-chat-sent.png`
- `07-A-convert.png`
- `08-A-convert-result.png`
- `13-A-qr.png`
- `14-B-home.png`
- `15-B-discover.png`
- `16-B-join.png`
- `17-B-join-result.png`
- `18-B-chat.png`
- `19-B-chat-sent.png`
- `22-B-roster-tip.png`
- `23-C-home.png`
- `24-C-join.png`
- `25-C-join-result.png`
- `26-C-chat.png`
- `27-C-chat-no-composer.png`
- `28-C-inbox.png`
- `29-C-qr.png`
- `30-C-demo-rail.png`
- `31-X-chat-disconnected.png`
- `32-A-dao13-hub.png`
- `33-A-dao13-stake.png`
- `34-A-dao13-treasury.png`
- `35-A-dao13-proposal4.png`
- `36-A-g14-convert.png`
- `37-C-g14-join.png`
- `38-C-g14-chat.png`

## Review
See `REVIEW.md` for PASS/FAIL per frame and UI fixes.
