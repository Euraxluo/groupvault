import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import type { MessageStore } from "./store.js"
import type { IndexerWorker } from "./worker.js"

const PAGE_LIMIT = 50

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  })
  response.end(payload)
}

export function createIndexerServer(
  store: MessageStore,
  worker: IndexerWorker,
  now: () => number = Date.now,
): Server {
  return createServer((request, response) => {
    try {
      route(request, response, store, worker, now)
    } catch (error) {
      json(response, 500, {
        error: error instanceof Error ? error.message : "internal error",
      })
    }
  })
}

function route(
  request: IncomingMessage,
  response: ServerResponse,
  store: MessageStore,
  worker: IndexerWorker,
  now: () => number,
): void {
  const url = new URL(request.url ?? "/", "http://127.0.0.1")

  if (request.method === "GET" && url.pathname === "/health") {
    const health = worker.health
    const updatedAt = store.getMeta("cursor_updated_at_ms")
    const cursorAge =
      health.lastProcessedBlock === null || updatedAt === null
        ? null
        : Math.max(0, now() - Number(updatedAt))
    json(response, 200, {
      ready: health.ready,
      last_finalized_block: health.lastFinalizedBlock,
      last_processed_block: health.lastProcessedBlock,
      cursor_age_ms: cursorAge,
      error: health.lastError,
    })
    return
  }

  if (request.method === "GET" && url.pathname === "/messages") {
    const groupRaw = url.searchParams.get("group_id")
    if (groupRaw === null || !/^\d+$/.test(groupRaw)) {
      json(response, 400, { error: "group_id must be a non-negative integer" })
      return
    }
    const groupId = Number(groupRaw)
    if (!Number.isSafeInteger(groupId)) {
      json(response, 400, { error: "group_id is out of range" })
      return
    }

    const limitRaw = url.searchParams.get("limit")
    const limit = limitRaw === null ? PAGE_LIMIT : Number(limitRaw)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_LIMIT) {
      json(response, 400, { error: `limit must be between 1 and ${PAGE_LIMIT}` })
      return
    }

    const cursor = url.searchParams.get("cursor")
    const page = store.page(groupId, cursor, limit)
    json(response, 200, {
      items: page.items.map((row) => ({
        group_id: row.groupId,
        sender: row.sender,
        text: row.text,
        ts: row.ts,
        receipt_id: row.receiptId,
        block_height: row.blockHeight,
        log_index: row.logIndex,
      })),
      next_cursor: page.next_cursor,
    })
    return
  }

  json(response, 404, { error: "not found" })
}
