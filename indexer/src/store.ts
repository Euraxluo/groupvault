import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname } from "node:path"

import type { IndexedMessage } from "./parser.js"

// Vite/Vitest strips the `node:` prefix from builtins, but `sqlite` only exists
// behind that prefix. Loading it through createRequire keeps both the test
// runner and the compiled server on the real built-in module.
const require = createRequire(import.meta.url)
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite")

export interface MessageRow extends IndexedMessage {
  rowId: number
}

export class MessageStore {
  private readonly db: InstanceType<typeof DatabaseSync>

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true })
    }
    this.db = new DatabaseSync(path)
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_blocks (
        block_height INTEGER PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS messages (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        ts TEXT NOT NULL,
        block_height INTEGER NOT NULL,
        UNIQUE (receipt_id, log_index)
      );
      CREATE INDEX IF NOT EXISTS messages_group_row
        ON messages (group_id, row_id);
    `)
  }

  close(): void {
    this.db.close()
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value)
  }

  initializeCursor(height: number): void {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.db
        .prepare(
          "INSERT OR IGNORE INTO meta (key, value) VALUES ('last_processed_block', ?)",
        )
        .run(String(height))
      this.db
        .prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('ready', '1')")
        .run()
      this.db
        .prepare(
          "INSERT OR IGNORE INTO meta (key, value) VALUES ('cursor_updated_at_ms', ?)",
        )
        .run(String(Date.now()))
      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  get lastProcessedBlock(): number | null {
    const value = this.getMeta("last_processed_block")
    return value === null ? null : Number(value)
  }

  get ready(): boolean {
    return this.getMeta("ready") === "1"
  }

  /**
   * Insert messages and advance the cursor atomically. Replayed blocks are
   * idempotent via the `(receipt_id, log_index)` key.
   */
  commitBlock(blockHeight: number, messages: IndexedMessage[]): number {
    if (this.hasBlock(blockHeight)) {
      // Idempotent replay: never double-count, but keep the cursor current.
      this.setMeta("last_processed_block", String(blockHeight))
      this.setMeta("cursor_updated_at_ms", String(Date.now()))
      return 0
    }

    this.db.exec("BEGIN IMMEDIATE")
    try {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO messages
          (receipt_id, log_index, group_id, sender, text, ts, block_height)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      let inserted = 0
      for (const message of messages) {
        const result = insert.run(
          message.receiptId,
          message.logIndex,
          message.groupId,
          message.sender,
          message.text,
          message.ts,
          message.blockHeight || blockHeight,
        )
        inserted += Number(result.changes)
      }
      this.db
        .prepare(
          "INSERT OR IGNORE INTO processed_blocks (block_height) VALUES (?)",
        )
        .run(blockHeight)
      this.setMeta("last_processed_block", String(blockHeight))
      this.setMeta("cursor_updated_at_ms", String(Date.now()))
      this.db.exec("COMMIT")
      return inserted
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  hasBlock(blockHeight: number): boolean {
    const row = this.db
      .prepare("SELECT 1 AS present FROM processed_blocks WHERE block_height = ?")
      .get(blockHeight) as { present: number } | undefined
    return row?.present === 1
  }

  page(groupId: number, cursor: string | null, limit: number): {
    items: MessageRow[]
    next_cursor: string | null
  } {
    const after = cursor === null ? 0 : decodeCursor(cursor)
    const rows = this.db
      .prepare(
        `SELECT row_id, receipt_id, log_index, group_id, sender, text, ts, block_height
           FROM messages
          WHERE group_id = ? AND row_id > ?
          ORDER BY row_id ASC
          LIMIT ?`,
      )
      .all(groupId, after, limit + 1) as Record<string, unknown>[]

    const page = rows.slice(0, limit).map((row) => ({
      rowId: Number(row.row_id),
      receiptId: String(row.receipt_id),
      logIndex: Number(row.log_index),
      groupId: Number(row.group_id),
      sender: String(row.sender),
      text: String(row.text),
      ts: String(row.ts),
      blockHeight: Number(row.block_height),
    }))

    return {
      items: page,
      next_cursor:
        rows.length > limit && page.length > 0
          ? encodeCursor(page[page.length - 1]!.rowId)
          : null,
    }
  }
}

export function encodeCursor(rowId: number): string {
  return Buffer.from(`v1:${rowId}`, "utf8").toString("base64url")
}

export function decodeCursor(cursor: string): number {
  let decoded: string
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8")
  } catch {
    throw new Error("ERR_INVALID_CURSOR")
  }
  const match = /^v1:(\d+)$/.exec(decoded)
  if (!match) throw new Error("ERR_INVALID_CURSOR")
  return Number(match[1])
}
