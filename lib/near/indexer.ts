export interface ChatMessage {
  group_id: number
  sender: string
  text: string
  ts: string
  receipt_id: string
  block_height: number
  log_index: number
}

export interface MessagePage {
  items: ChatMessage[]
  next_cursor: string | null
}

export async function getMessages(
  indexerUrl: string,
  groupId: number,
  cursor?: string | null,
  fetcher: typeof fetch = fetch,
): Promise<MessagePage> {
  const url = new URL("/messages", indexerUrl)
  url.searchParams.set("group_id", String(groupId))
  if (cursor) url.searchParams.set("cursor", cursor)

  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`Indexer /messages failed: HTTP ${response.status}`)
  }
  return (await response.json()) as MessagePage
}

export interface IndexerHealth {
  ready: boolean
  last_finalized_block: number | null
  last_processed_block: number | null
  cursor_age_ms: number | null
  error?: string | null
}

export async function getIndexerHealth(
  indexerUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<IndexerHealth> {
  const response = await fetcher(new URL("/health", indexerUrl))
  if (!response.ok) {
    throw new Error(`Indexer /health failed: HTTP ${response.status}`)
  }
  return (await response.json()) as IndexerHealth
}
