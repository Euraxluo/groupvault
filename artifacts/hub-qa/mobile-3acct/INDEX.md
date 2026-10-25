# Mobile 3-account storyboard

Updated: 2026-10-25 ~10:17 Asia/Shanghai

## Accounts
- **A:** `gv-a-1024-210252.testnet` (~1.36 NEAR)
- **B:** `gv-b-1024-210252.testnet`
- **C:** `gv-topup-mvmi9vo1.testnet` (**member of group 14**)

## Group 14 (`Mobile3 5oip0`)
- **fresh create** earlier; members: A, B, **C** (C joined on-chain with correct `{"action":"join","group_id":14}` msg)
- C `send_message` on-chain + UI send (optimistic bubble)
- **Convert:** attempted in UI; **not completed**
  - Contract `CONVERT_DEPOSIT` = **10 NEAR**; A has ~**1.36 NEAR**
  - Testnet faucet unreachable from this host (`rpc.testnet.near.org` connect timeout; near-cli `--useFaucet` fails)
  - Broadcast also stalls under fastnear 429 ("Waiting for wallet…")
- **DAO visuals:** still use group **13** frames for TokenWeight story

## RPC note
- Tried `https://rpc.testnet.near.org` (times out here), Pagoda deprecated/403, Lava gone
- App/indexer back on `https://test.rpc.fastnear.com` with failover + 429 backoff
- `.env.local` documents this

## Viewport
- 390×844 · isMobile · hasTouch · `fullPage: false`

## Frames (46)
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
- `39-C-join-success.png`
- `40-C-chat-member.png`
- `41-C-chat-sent-optimistic.png`
- `42-A-convert-predao.png`
- `43-A-convert-blocked.png`
- `43-A-convert-disabled.png`
- `43-A-convert-result.png`
- `44-A-g14-overview.png`
- `45-A-chat-sees-C.png`
- `46-B-roster-tip.png`
- `48-A-dao13-retry-ux.png`
- `49-A-convert-deposit-note.png`

## Review
See `REVIEW.md`.
