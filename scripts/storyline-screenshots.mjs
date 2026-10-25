import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100"
const out = path.resolve("artifacts/hub-qa/storyline")
fs.mkdirSync(out, { recursive: true })

const pages = [
  ["01-home", "/"],
  ["02-demo", "/demo"],
  ["03-groups-new", "/groups/new"],
  ["04-groups", "/groups"],
  ["05-discover", "/discover"],
  ["06-join", "/groups/13/join"],
  ["07-overview", "/groups/13"],
  ["08-chat", "/groups/13/chat"],
  ["09-convert", "/groups/13/convert"],
  ["10-dao", "/dao/groupvault-13.sputnikv2.testnet"],
  ["11-staking-setup", "/dao/groupvault-13.sputnikv2.testnet/staking/setup"],
  ["12-stake", "/dao/groupvault-13.sputnikv2.testnet/stake"],
  ["13-treasury", "/dao/groupvault-13.sputnikv2.testnet/treasury"],
  ["14-proposals", "/dao/groupvault-13.sputnikv2.testnet/proposals?ids=1,2,3,4"],
  ["15-proposal-detail", "/dao/groupvault-13.sputnikv2.testnet/proposals/4"],
  ["16-qr", "/me/qr"],
  ["17-inbox", "/inbox"],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
for (const [name, route] of pages) {
  await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(800)
  const file = path.join(out, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log("wrote", file)
}
await browser.close()
