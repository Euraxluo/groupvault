# Mobile Web3 UX review — hub-qa/mobile-3acct

Viewport: **390×844** iPhone 14 · `fullPage: false` phone frame · Asia/Shanghai run 2026-10-25.

North-star: NearDao web3-app refs (`~/project/groupvault-assets/neardao-web3-app/`).

## Global fixes applied this run
| Issue | Fix |
| --- | --- |
| Marketing home sprawl | Rewrote `/` as dense app shell (dark hero + 2×2 quick actions + compact demo rail) |
| Chat nav wrong active | `isNavActive`: `/groups/:id/chat` lights **Chat**, not Groups |
| Disconnected chat dead composer | Big **Connect to chat** CTA → opens wallet chip |
| Next.js floating **N** badge | `devIndicators: false` + CSS kill for `nextjs-portal` / badge selectors |
| Tiny Convert / Stake / Tip / Join CTAs | `h-11`–`h-12` min tap targets, stacked stake actions |
| RPC “Exceeded 2 providers” | Keypair signer + NearRpc: more failover URLs + 429/timeout retries |
| Group load stuck | `useGroupVault` no longer marks unavailable while selector boots |

## Per-frame notes

| Frame | Verdict | Notes |
| --- | --- | --- |
| `00-smoke-home` / `01-A-home` | **PASS** | App chrome, thumb CTAs, no N badge, account chip when connected |
| `02-A-groups` | **PASS** | List + New; pb-28 clears bottom nav |
| `03-A-create-form` | **PASS** | Form fits phone; create succeeded → group **14** |
| `04-A-overview` | **PASS** | Overview CTAs ≥44px |
| `05-A-chat` / `06-A-chat-sent` | **PASS** | Chat tab active; send path real |
| `07-A-convert` / `08-A-convert-result` / `36-A-g14-convert` | **PASS** layout / **FAIL** chain | Thumb Convert CTA; browser convert hit RPC 429 (“Exceeded 2 providers”). Group 14 still pre-DAO |
| `13-A-qr` | **PASS** | QR card readable on phone |
| `14-B-home`–`15-B-discover` | **PASS** | B chip visible; discover cards |
| `16-B-join` / `17-B-join-result` | **PASS** | Real join; “You are a member” |
| `18-B-chat` / `19-B-chat-sent` | **PASS** | B message path |
| `22-B-roster-tip` | **PASS** | Roster / Tip affordance present |
| `23-C-home`–`24-C-join` | **PASS** layout | C connected as `gv-topup-mvmi9vo1.testnet` |
| `25-C-join-result` / `37-C-g14-join` | **FAIL** chain | Join CTA shown; RPC 429 + briefly insufficient NEAR (~0.099). Topped up +0.25N; join still blocked by sustained fastnear 429 |
| `26-C-chat` / `27-C-chat-no-composer` / `38-C-g14-chat` | **PASS** UX | Honest **Join to send** CTA; Chat tab correctly active |
| `28-C-inbox` / `29-C-qr` / `30-C-demo-rail` | **PASS** | Phone rail usable (horizontal cards) |
| `31-X-chat-disconnected` | **PASS** | Connect CTA; Chat active; no Groups false-active |
| `32-A-dao13-hub` | **PASS** layout / soft-FAIL data | Thumb stack CTAs; Vote policy “Loading…” / staking “not set” are RPC lag (chain already TokenWeight on group 13) |
| `33-A-dao13-stake` | soft-FAIL | Stuck “Loading DAO…” under 429 — form exists when RPC answers |
| `34-A-dao13-treasury` | **PASS** (layout) | Phone treasury |
| `35-A-dao13-proposal4` | **PASS** | Approved Transfer #4; Approve CTA thumb-sized; account chip clear |

## Critical path score
- **UI / responsive / phone framing:** critical screens **PASS** after iteration.
- **3-tab story:** A create+chat, B join+chat, C connect+attempt join+inbox/QR — **real**. Fresh **group 14**.
- **Convert / C join / stake live txs this run:** blocked by **fastnear HTTP 429** (honest). Group **13** DAO frames labeled separately for governance visuals.

## Remaining polish (non-blocking)
- Stake/DAO hub empty/loading under RPC failure should surface a retry banner (not “not set”).
- Home quick-action still deep-links demo group 13 by design; group 14 is the fresh 3-actor path.
- Prefer dedicated `INDEXER_RPC_URL` / paid RPC for unattended demos.

## Continuation 2026-10-25 10:17 CST

### Chain
| Step | Result |
| --- | --- |
| C join group 14 | **PASS** — member; FT msg must include `action:"join"` |
| C chat message | **PASS** — on-chain + UI; optimistic "sent · waiting for indexer" |
| A Convert group 14 | **BLOCKED** — needs **10 NEAR** deposit; A≈1.36N; faucet unreachable; RPC 429 stalls signer |

### New / updated frames
| Frame | Verdict | Notes |
| --- | --- | --- |
| `39-C-join-success` | **PASS** | "You are a member of this group." |
| `40-C-chat-member` | **PASS** | Composer; 3 members; Chat tab active; privacy one-liner |
| `41-C-chat-sent-optimistic` | **PASS** | Dashed bubble + "sent · waiting for indexer" |
| `42-A-convert-predao` | **PASS** layout | Form loads after Retry; deposit shown |
| `43-A-convert-result` | **FAIL** chain | Stuck "Waiting for wallet…" / cannot fund 10N |
| `44-A-g14-overview`–`48-A-dao13-retry-ux` | **PASS** UX | Overview/chat/roster/DAO retry polish |

### Soft UX this round
- Privacy banner: compact collapsible one-liner
- Chat: immediate optimistic pending bubble label
- DAO hub + stake panel + convert: Retry on load/RPC fail; do not claim staking unset on error
