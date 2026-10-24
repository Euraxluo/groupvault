#!/usr/bin/env node

import { spawn } from "node:child_process"
import path from "node:path"
import process from "node:process"

// pnpm 12 forwards the literal `--` separator in `pnpm dev -- --port 3000`.
// Next would read it as the project directory, so remove only that separator.
const args = process.argv.slice(2).filter((arg) => arg !== "--")
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")

const child = spawn(process.execPath, [nextBin, "dev", ...args], {
  stdio: "inherit",
  env: process.env,
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal))
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
