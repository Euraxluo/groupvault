export interface IndexedMessage {
  receiptId: string
  logIndex: number
  groupId: number
  sender: string
  text: string
  ts: string
  blockHeight: number
}

const STANDARD = "groupvault"
const VERSION = "0.1.0"

function parseInt64String(value: unknown): string | null {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return null
  return value
}

export function parseLog(
  receiptId: string,
  logIndex: number,
  raw: string,
): IndexedMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null

  const value = parsed as Record<string, unknown>
  if (value.standard !== STANDARD || value.version !== VERSION) return null
  if (value.event !== "message") return null

  const data = value.data
  if (!data || typeof data !== "object") return null
  const payload = data as Record<string, unknown>

  const groupId = payload.group_id
  if (
    typeof groupId !== "number" ||
    !Number.isSafeInteger(groupId) ||
    groupId < 0
  ) {
    return null
  }
  if (typeof payload.sender !== "string" || payload.sender.length === 0) {
    return null
  }
  if (typeof payload.text !== "string") return null
  const ts = parseInt64String(payload.ts)
  if (!ts) return null

  return {
    receiptId,
    logIndex,
    groupId,
    sender: payload.sender,
    text: payload.text,
    ts,
    blockHeight: 0,
  }
}

export function parseReceiptLogs(
  receiptId: string,
  logs: string[],
  blockHeight: number,
): IndexedMessage[] {
  const messages: IndexedMessage[] = []
  logs.forEach((raw, logIndex) => {
    const message = parseLog(receiptId, logIndex, raw)
    if (message) {
      messages.push({ ...message, blockHeight })
    }
  })
  return messages
}
