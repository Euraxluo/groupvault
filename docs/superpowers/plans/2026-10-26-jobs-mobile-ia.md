# GroupVault Jobs Mobile IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GroupVault mobile shell so the story is “付费进群聊天，成熟了就一键变成 DAO”: chat-first navigation, human copy, near-black visuals, and post-Convert treasury glance before returning to chat.

**Architecture:** Keep existing Next.js App Router routes and on-chain clients (`lib/near/*`). Replace chrome and entry surfaces: bottom nav → 消息/发现/我的; `/` and `/chat` become the conversation list; group overview becomes a sheet from chat; Convert success redirects through treasury once. Do not change contract methods or deposit math—only display and navigation.

**Tech Stack:** Next.js App Router, React client components, Tailwind + CSS variables in `app/globals.css`, Vitest + existing `tests/web` / `tests/smoke`, Playwright where noted, `pnpm`.

**Spec:** `docs/superpowers/specs/2026-10-26-jobs-mobile-ia-design.md`

## Global Constraints

- Phone-first ~390×844; Chinese UI copy on primary surfaces.
- Product line: 付费进群聊天，成熟了就一键变成 DAO.
- Bottom nav exactly three: 消息 · 发现 · 我的 (no Groups/DAO/Inbox tabs).
- After Convert success: show treasury glance, then primary CTA 回到聊天.
- Never show raw yocto on primary UI; use human NEAR via `formatNearAmount`.
- Do not modify `~/project/project/sui_project_c/multisig`.
- Demo port remains 3100 when Metabase owns 3000.
- YAGNI: no DKG entry, no Demo Story rail on home, no new chain features.

## File map

| File | Responsibility |
| --- | --- |
| `lib/near/format.ts` (+ test) | yocto ↔ display NEAR |
| `app/globals.css` | near-black primary tokens |
| `components/mobile-navbar.tsx` | 三格底栏 + 精简顶栏 |
| `app/page.tsx` | redirect → `/chat` |
| `app/chat/page.tsx` | 消息列表（群会话） |
| `components/group-overview-sheet.tsx` | 群概况 sheet |
| `app/groups/[groupId]/chat/page.tsx` | 顶栏「群」+ sheet；弱化 PrivacyNotice |
| `app/groups/[groupId]/page.tsx` | redirect → chat（或薄跳转） |
| `app/groups/[groupId]/convert/page.tsx` + `components/convert-form.tsx` | 中文/人类金额；成功 → treasury?from=convert |
| `app/dao/[daoId]/treasury/page.tsx` | convert glance 模式 + 回到聊天 |
| `app/me/page.tsx` | 我的 |
| `app/discover/page.tsx` | 中文卡片文案 |
| `app/groups/new/page.tsx` | 中文创建流 |
| `app/dao/page.tsx`, `app/inbox/page.tsx`, `app/groups/page.tsx`, `app/demo/page.tsx` | redirect / 降级 |
| `tests/smoke/page.test.tsx`, `tests/web/home.spec.ts` | 导航与空态断言 |

---

### Task 1: `formatNearAmount` helper

**Files:**
- Create: `lib/near/format.ts`
- Create: `lib/near/format.test.ts`
- Modify: `lib/near/index.ts` (re-export)

**Interfaces:**
- Produces: `formatNearAmount(yocto: string | bigint, digits?: number): string` → e.g. `"1"`, `"0.5"`, `"6"`; never scientific yocto string for UI.
- Produces: `parseNearToYocto(near: string): string` for forms that still submit yocto.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest"
import { formatNearAmount, parseNearToYocto } from "./format"

describe("formatNearAmount", () => {
  it("formats whole NEAR without yocto dump", () => {
    expect(formatNearAmount("1000000000000000000000000")).toBe("1")
  })
  it("formats 0.5 NEAR", () => {
    expect(formatNearAmount("500000000000000000000000")).toBe("0.5")
  })
})

describe("parseNearToYocto", () => {
  it("parses 1 to 24 zeros", () => {
    expect(parseNearToYocto("1")).toBe("1000000000000000000000000")
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm exec vitest run lib/near/format.test.ts`  
Expected: fail (module missing)

- [ ] **Step 3: Implement**

```ts
const YOCTO = 10n ** 24n

export function formatNearAmount(yocto: string | bigint, digits = 4): string {
  const v = typeof yocto === "bigint" ? yocto : BigInt(yocto || "0")
  const whole = v / YOCTO
  const frac = v % YOCTO
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "")
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}

export function parseNearToYocto(near: string): string {
  const t = near.trim()
  if (!t || !/^\d+(\.\d+)?$/.test(t)) throw new Error("Invalid NEAR amount")
  const [w, f = ""] = t.split(".")
  const frac = (f + "000000000000000000000000").slice(0, 24)
  return (BigInt(w) * YOCTO + BigInt(frac)).toString()
}
```

Re-export from `lib/near/index.ts`: `export * from "./format"`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm exec vitest run lib/near/format.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/near/format.ts lib/near/format.test.ts lib/near/index.ts
git commit -m "feat(near): add formatNearAmount for human UI amounts"
```

---

### Task 2: Near-black design tokens

**Files:**
- Modify: `app/globals.css` (`:root` / `.dark` `--primary*` / `--accent*` / `--ring` from purple `262 83%…` → near-black / neutral)

- [ ] **Step 1: Write smoke assertion (optional vitest on exported CSS not required). Prefer Playwright/home later. For this task, document expected token values in commit.**

- [ ] **Step 2: Change `:root` primary to near-black**

Set approximately:
```css
--primary: 0 0% 9%;
--primary-foreground: 0 0% 98%;
--accent: 0 0% 96%;
--accent-foreground: 0 0% 9%;
--ring: 0 0% 9%;
```
Keep success greens only in component classNames where needed (connected state), not as `--primary`.

- [ ] **Step 3: Visual check**

Run: `pnpm dev` (port 3100 if configured). Open `/chat` at 390 width — primary buttons should be near-black, not purple.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style: switch primary tokens to near-black Jobs chrome"
```

---

### Task 3: Bottom nav → 消息 / 发现 / 我的

**Files:**
- Modify: `components/mobile-navbar.tsx`
- Modify: `tests/smoke/page.test.tsx` and/or `tests/web/home.spec.ts`

**Interfaces:**
- Nav items: `{ href: "/chat", label: "消息" }`, `{ href: "/discover", label: "发现" }`, `{ href: "/me", label: "我的" }`
- Active: `/chat` and `/groups/*/chat` → 消息; `/discover` → 发现; `/me` → 我的
- Remove Demo link from header; keep wallet connect (or move connect primarily to `/me` but header Connect OK for demo speed)

- [ ] **Step 1: Update / add test expecting three labels 消息/发现/我的 and no Inbox/DAO**

Example Playwright (`tests/web/home.spec.ts`):
```ts
test("bottom nav is messages discover me", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/chat")
  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("消息")
  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("发现")
  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("我的")
  await expect(page.getByRole("navigation", { name: "Primary" })).not.toContainText("Inbox")
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Rewrite `navigation` const and `isNavActive` in `mobile-navbar.tsx`**

```ts
const navigation = [
  { href: "/chat", label: "消息", icon: MessageSquareText },
  { href: "/discover", label: "发现", icon: Users },
  { href: "/me", label: "我的", icon: Wallet },
] as const
```

Update `isNavActive` for `/chat` (include group chat paths), `/discover`, `/me`. Remove Groups/DAO/Inbox entries. Remove header Demo button.

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git add components/mobile-navbar.tsx tests/web/home.spec.ts
git commit -m "feat(nav): Jobs three-tab bar 消息/发现/我的"
```

---

### Task 4: `/` → `/chat` messages list (empty state + group rows)

**Files:**
- Modify: `app/page.tsx` → `redirect("/chat")` (server)
- Modify: `app/chat/page.tsx` → list user’s groups (reuse data hooks from `app/groups/page.tsx` / `group-list.tsx`); empty state copy from spec
- Modify or reuse: `components/group-list.tsx` if present
- Remove home usage of `DemoStoryRail` / black hero

**Empty state copy (exact):**
- Title/body: `付费进群聊天，成熟了就一键变成 DAO`
- Buttons: `发现群` → `/discover`, `新建群` → `/groups/new`

- [ ] **Step 1: Test empty state strings on `/chat`**

- [ ] **Step 2: FAIL then implement list + empty state; delete Demo Story from home path**

- [ ] **Step 3: `app/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
export default function Home() {
  redirect("/chat")
}
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(messages): chat index as Jobs home with empty state"
```

---

### Task 5: Group overview sheet from chat

**Files:**
- Create: `components/group-overview-sheet.tsx`
- Modify: `app/groups/[groupId]/chat/page.tsx` (header button 群)
- Modify: `app/groups/[groupId]/page.tsx` → `redirect` to `./chat` (keep query if any)

**Sheet content:**
- 成员数、入群费 (`formatNearAmount`)、状态（群 / 已是 DAO）
- Owner + not converted: CTA `升级为 DAO` → `/groups/[id]/convert`
- Converted: CTA `金库与投票` → `/dao/[daoId]/treasury`
- Privacy: one dismissible line, not yellow wall

- [ ] **Step 1: Component test or Playwright: open sheet from chat header**

- [ ] **Step 2: Implement sheet with shadcn `Sheet` (`components/ui/sheet.tsx`)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(chat): group overview sheet with upgrade CTA"
```

---

### Task 6: Convert copy + success → treasury glance → back to chat

**Files:**
- Modify: `components/convert-form.tsx`, `app/groups/[groupId]/convert/page.tsx`
- Modify: `app/dao/[daoId]/treasury/page.tsx`
- Modify: `tests/web/convert-flow.test.tsx`

**Behavior:**
- Page title `升级为 DAO`; button `确认升级` / `升级`; show deposit via `formatNearAmount(CONVERT_DEPOSIT)`
- Hide yocto code block; move protocol note to small muted text
- On success: `router.push(/dao/${daoId}/treasury?from=convert&groupId=${groupId})`
- Treasury when `from=convert`: banner `升级成功` + balance + button `回到聊天` → `/groups/${groupId}/chat`
- Chat header shows small `DAO` badge when `dao_id` set

- [ ] **Step 1: Update convert-flow test expectations for Chinese CTA and redirect query**

- [ ] **Step 2: Implement form + treasury glance mode**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(convert): human copy and post-upgrade treasury glance"
```

---

### Task 7: 发现 + 新建群 + 我的

**Files:**
- Modify: `app/discover/page.tsx` — Chinese labels; fee via `formatNearAmount`
- Modify: `app/groups/new/page.tsx` / create dialog — `创建`; success → that group’s chat
- Create: `app/me/page.tsx` — account, balance if easy, network testnet, disconnect, link QR

- [ ] **Step 1: Smoke: `/me` renders 我的 and disconnect control when connected (mock wallet if tests already mock)**

- [ ] **Step 2: Implement pages**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(me): profile tab; Chinese discover and create copy"
```

---

### Task 8: Legacy route redirects + kill Demo Story entry

**Files:**
- Modify: `app/dao/page.tsx` → redirect `/chat` (or last dao if stored—default `/chat`)
- Modify: `app/inbox/page.tsx` → redirect `/chat`
- Modify: `app/groups/page.tsx` → redirect `/chat`
- Modify: `app/demo/page.tsx` → redirect `/chat` (or keep behind `/demo` but remove all primary links)
- Stop rendering `components/demo-story-rail.tsx` on any primary surface (may leave file)

- [ ] **Step 1: Playwright: `/inbox`, `/dao`, `/groups` end on messages UX**

- [ ] **Step 2: Implement redirects**

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(routes): redirect legacy Groups/DAO/Inbox/Demo to messages"
```

---

### Task 9: Phone storyboard smoke (390×844)

**Files:**
- Modify: `tests/web/storyline.spec.ts` or add `tests/web/jobs-ia.spec.ts`

- [ ] **Step 1: Spec covers:** bottom 3 tabs; empty copy; open group chat; sheet CTA labels; convert page has no yocto dump; treasury glance has 回到聊天

- [ ] **Step 2: Run `pnpm test:web` (or project’s playwright web config) — fix failures

- [ ] **Step 3: Commit**

```bash
git commit -m "test: Jobs IA phone storyline smoke"
```

- [ ] **Step 4: Manual hub QA** — capture frames continuing INDEX next=74 under `artifacts/hub-qa/mobile-3acct/` for: messages empty, discover, chat, sheet, convert confirm, treasury glance, back to chat with DAO badge. Update INDEX/STATUS.

---

## Spec coverage check

| Spec section | Task |
| --- | --- |
| 3s promise / empty state | 4 |
| Nav 消息/发现/我的 | 3 |
| Chat-first + group sheet | 5 |
| Visual near-black | 2 |
| Human NEAR / no yocto | 1, 6, 7 |
| Convert → treasury glance → chat | 6 |
| Discover / create / me | 7 |
| Kill Demo Story / legacy tabs | 4, 8 |
| Phone 390 acceptance | 9 |

## Out of scope

- Contract redeploy, Convert deposit changes, indexer, DAO delete tooling
- Full Trezu parity, staking setup redesign beyond link from treasury secondary
