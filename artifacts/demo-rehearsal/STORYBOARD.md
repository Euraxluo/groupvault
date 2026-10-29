# Demo Rehearsal Storyboard — 付费进群聊天，成熟了就一键变成 DAO

Hackathon window: 2026-11-01 08:00 → 2026-11-15 07:59 CST.
Target: a repeatable **60–90 秒** phone walkthrough, 10 stills, **全程零签名**.

Live surfaces (hub-managed, do not restart): demo `:3100`, indexer `:8787`.
Stills captured 2026-10-29 at 390×844 / DPR2 (PNG 780×1688) against
`http://127.0.0.1:3100`.

## How to re-run

```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
cd /Users/echo/project/groupvault
BASE_URL=http://127.0.0.1:3100 pnpm exec tsx scripts/demo-rehearsal.mjs
```

The script requires `:3100` and `:8787` to already be up (it only probes them),
refuses to overwrite nothing but re-renders each `R*.png` in place, fails on any
`send_tx` / `sign_and_send_tx` request, and rewrites `_stills.json` +
`_last-run.log` with the run's real URLs, byte sizes and balance text.

## Anchors used by these stills

| Role | Group | Chain identity | State |
| --- | --- | --- | --- |
| Unconverted fixture | 17 | `Jobs IA mvt0xqda` | owner A, `dao_id=null`, `convert_pending=false`, 1 member |
| DAO fixture | 16 | `Mobile3 sxqh5` → `gv16-8jh4.sputnikv2.testnet` | 3 members, treasury 6.3501 NEAR |
| Converted showcase (backup) | 18 | `Jobs IA mvt0zf6x` → `groupvault-18.sputnikv2.testnet` | 2 members, chat indexed |

## Presenter script（60–90 秒）

Say the 「口播」line once the still is on screen. Keep each beat 6–9 秒.

### R1 — 首页 / 消息 tab（`R1-home-messages.png`）

打开 `:3100/chat`，拇指指着底栏。

> 口播：**GroupVault：付费进群聊天，成熟了就一键变成 DAO。** 底栏只有三格——消息、发现、我的。

画面要点：消息 tab 高亮；列表是链上真实群（19 个，含 `群聊` / `DAO` 徽标），入群费写成人话「1 入群币」。

### R2 — 发现 tab（`R2-discover.png`）

点底栏「发现」。

> 口播：发现页把所有公开群摊开，价格都是「入群币」，不是 1000000 这种最小单位。

画面要点：`1 位成员 · 入群费 1 入群币` + 「查看并加入」。

### R3 — 群 17 付费进群（`R3-group17-join.png`）

打开 `:3100/groups/17/join`。**该镜头用 B 账号（非成员）视角**，右上角 chip 是 `gv-b-102…`。

> 口播：进一个还没升级的群，先撞上付费墙——付 1 枚入群币才是成员。小字写得很清楚：付费只买成员资格，不等于投票权重。

画面要点：`支付 1 入群币并加入` 按钮**可点但不点**；`群聊` 徽标证明未升级。

### R4 — 群 17 聊天（`R4-group17-chat.png`）

打开 `:3100/groups/17/chat`。

> 口播：成为成员后就是普通群聊，公开链上、按成员身份发言。

画面要点：标题无 DAO 徽标、`1 位成员 · 公开链上聊天`、成员才有输入框。

### R5 — 群概况 sheet（`R5-group17-sheet.png`）

点右上「群」。

> 口播：点「群」看概况：成员、入群费、打赏，以及群主的「升级为 DAO」——成熟了，就这一下。

画面要点：`付费群聊` + `群聊` 徽标、成员 1、入群费 `1 入群币`、名单 `群主`、自己打赏按钮禁用、底部「升级为 DAO」。
**只截图，绝不点击**（点了就是 10 NEAR 的真实交易）。

### R6 — 群 16 聊天（`R6-group16-chat.png`）

打开 `:3100/groups/16/chat`。

> 口播：这是升级完的同一个群：群还是那个群，聊天也还是那个聊天，只是标题多了 DAO 徽标。

画面要点：`Mobile3 sxqh5` + `DAO` 徽标、`3 位成员`、成员输入框可用。

### R7 — 群 16 概况 sheet（`R7-group16-sheet.png`）

点「群」。

> 口播：升级后概况变成「已是 DAO」，多出金库与投票、提案、质押——同一个入口，多了治理。

画面要点：`已是 DAO`、成员 3、3 条真实名单（A 群主 / B / topup）、`金库与投票` 主按钮 + 金库/提案/质押。

### R8 — DAO 金库一眼（`R8-dao16-treasury.png`）

打开 `:3100/dao/gv16-8jh4.sputnikv2.testnet/treasury?from=convert&groupId=16`。

> 口播：金库余额是链上现读的——`6.3501 NEAR`，不是演示数据。

画面要点：`升级成功` + DAO 徽标、`DAO 金库余额 6.3501 NEAR`。
（数字会随链上变化；以 `_stills.json` 里本次 `balanceText` 为准，若不同就照读屏幕。）

### R9 — 回到聊天 CTA 落点（`R9-back-to-chat.png`）

点「回到聊天」。

> 口播：升级完一键回到原群聊——治理不打断聊天。

画面要点：URL 落回 `/groups/16/chat`，标题 `Mobile3 sxqh5` + DAO；CTA 已验证 href = `/groups/16/chat`。

### R10 — 我的 tab（`R10-me-qr.png`）

点底栏「我的」。

> 口播：我的页也是真余额和二维码——扫一下就把人拉进同一个 testnet 世界。

画面要点：`gv-a-1024-210252.testnet`、`testnet` 徽标、可用余额（本次 7.1992 NEAR）、「我的二维码」。

---

## 诚实兜底话术（照读，不解释系统内部）

### 索引器追赶 / 聊天稀疏

`:8787` 修过一次游标（2026-10-29），**10-26 那批历史消息被有意跳过**，所以群 16 的聊天室目前是
**空的白板 + 「正在等待索引器同步，新消息可能稍后出现。」**。这是真实状态，按下面的说法讲：

> 「聊天走链上公开日志，前端只显示索引器确认过的内容。现在索引器在追块，所以旧消息这一屏是空的——群 18 那条刚发的消息能证明链路是通的。」

群 16 / 群 17 聊天当前都是 `items: []`（`GET /messages?group_id=16|17`），**不要说「聊天记录很多」**。

### 网络繁忙

页面出现 `网络繁忙`（组信息 RPC 429/超时）：

> 「测试网公共 RPC 在限流，界面如实报错并给了重试——不是假数据在撑场面。」

点一次「重试」；若仍失败，直接跳到 R8（金库页单独读余额，通常独立成功）。

### 余额暂不可用

金库 / 我的页出现 `余额暂不可用`：

> 「这会儿 RPC 没回上来，余额这一格我宁可空着也不编一个数。」

脚本在这种情况下**会失败退出**（R8 要求真实余额），此时改用 R10 或备份锚点。

### 钱包 chip 不一致

R3 是 B 视角（`gv-b-102…`），其余是 A（`gv-a-102…`）。如果要口播这一点：

> 「这一张换成还没进群的另一个成员，所以看到的是付费墙而不是群主视角。」

---

## 3 个备用锚点（任一 live 页面挂掉时切）

### 备份 1 — 群 18 DAO（升级后真实聊天）

- 页面：`:3100/groups/18/chat`，DAO `groupvault-18.sputnikv2.testnet`
- 已验证（本次复读）：标题 `Jobs IA mvt0zf6x` + `DAO`、`2 位成员`、真实消息
  `Jobs IA public chat 1793247095372`（A 发送，约 3 小时前，block 275248121）
- 口播替换：「这是今天现场跑通的那一组：建群 → 付费进群 → 聊天 → 一键升级，链上都留着。」

### 备份 2 — 已归档 7 帧（156–162）

`artifacts/hub-qa/mobile-3acct/`（390×844 / DPR2，hub 已验）：

| 帧 | 文件 | 内容 |
| --- | --- | --- |
| 156 | `156-messages.png` | 消息 tab |
| 157 | `157-discover.png` | 发现 tab |
| 158 | `158-g16-chat.png` | 群 16 聊天 |
| 159 | `159-g16-sheet.png` | 群 16 概况（DAO） |
| 160 | `160-convert-confirm.png` | 群 17 升级确认（`约 10 NEAR`，未点击） |
| 161 | `161-treasury-glance.png` | 金库（6.3501 NEAR，PASS） |
| 162 | `162-back-to-chat.png` | 回到聊天 |

口播替换：这 7 帧是同一套 IA 的 hub 验收照，R1/R2/R6/R7/R8/R9 都可直接用它们顶。

### 备份 3 — E2E 证据 JSON

- `artifacts/jobs-ia-e2e-result.json` — `status=verified`，DAO `groupvault-18.sputnikv2.testnet`，
  `back_url=http://127.0.0.1:3100/groups/18/chat`，`indexed_message=true`
- `artifacts/jobs-ia-e2e.json` — 同一次跑的完整证据（create/join/chat/convert tx hash、receipt、
  成员、DAO council、treasury）
- `_last-chain.json` 附近的 `artifacts/hub-qa/mobile-3acct/_last-chain.json` 记录帧索引与 153–155 哈希

口播替换：「这是这次运行的四笔真实交易哈希和索引器结果，任何人可以拿去 testnet 复核。」

---

## 本次运行的真实状态（不要美化）

| 镜头 | 状态 | 说明 |
| --- | --- | --- |
| R1 / R2 | 完整 | 19 个真实群、入群费 `1 入群币` |
| R3 | 完整（B 视角） | 付费墙可点未点；群 17 未升级 |
| R4 | **稀疏** | 群 17 聊天 0 条消息（索引器未索引到该群历史） |
| R5 | 完整 | 「升级为 DAO」可见、未点击 |
| R6 / R9 | **稀疏** | 群 16 聊天 0 条消息 + 「正在等待索引器同步」 |
| R7 | 完整 | 3 成员、DAO、金库与投票入口 |
| R8 | 完整 | 链上 6.3501 NEAR |
| R10 | 完整 | 7.1992 NEAR 可用余额 |

`/health` 当时 `ready:true` 但带 `error:"RPC block failed with HTTP 429"`，
`last_processed_block` 落后 head 约 7000 块——这就是 R4/R6 空白的唯一原因，
不是产品 bug，也不是被墙掉的证据。

## 禁止事项（演前必读）

- 不签署任何交易：Convert / Join / Tip / 转账一律不点。
- 不创建群、不改合约状态。
- 不重启、不 kill、不 `pnpm dev`——`:3100` / `:8787` 都是 hub 管的。
- 不在聊天框输入任何真实密钥或隐私内容（聊天是公开链上日志）。
- 不在直播里粘贴私钥；Keypair (demo) 只在脚本运行时从 `~/.near-credentials` 读。
