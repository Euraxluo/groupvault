import { describe, expect, it } from "vitest"

import { parseLog, parseReceiptLogs } from "../src/parser.js"

const valid = JSON.stringify({
  standard: "groupvault",
  version: "0.1.0",
  event: "message",
  data: {
    group_id: 3,
    sender: "alice.testnet",
    text: "hello",
    ts: "1760000000000000000",
  },
})

describe("parseLog", () => {
  it("accepts the canonical schema", () => {
    expect(parseLog("receipt", 2, valid)).toMatchObject({
      receiptId: "receipt",
      logIndex: 2,
      groupId: 3,
      sender: "alice.testnet",
      text: "hello",
      ts: "1760000000000000000",
    })
  })

  it("rejects wrong standard, version, event, and malformed json", () => {
    expect(parseLog("r", 0, "not json")).toBeNull()
    expect(
      parseLog("r", 0, valid.replace('"groupvault"', '"other"')),
    ).toBeNull()
    expect(parseLog("r", 0, valid.replace('"0.1.0"', '"0.2.0"'))).toBeNull()
    expect(parseLog("r", 0, valid.replace('"message"', '"join"'))).toBeNull()
  })

  it("rejects bad group ids, senders, text, and timestamps", () => {
    const mutate = (patch: Record<string, unknown>) =>
      JSON.stringify({
        standard: "groupvault",
        version: "0.1.0",
        event: "message",
        data: {
          group_id: 3,
          sender: "alice.testnet",
          text: "hello",
          ts: "1",
          ...patch,
        },
      })

    expect(parseLog("r", 0, mutate({ group_id: -1 }))).toBeNull()
    expect(parseLog("r", 0, mutate({ group_id: 1.5 }))).toBeNull()
    expect(parseLog("r", 0, mutate({ group_id: "3" }))).toBeNull()
    expect(parseLog("r", 0, mutate({ sender: "" }))).toBeNull()
    expect(parseLog("r", 0, mutate({ text: 42 }))).toBeNull()
    expect(parseLog("r", 0, mutate({ ts: 1 }))).toBeNull()
    expect(parseLog("r", 0, mutate({ ts: "abc" }))).toBeNull()
  })
})

describe("parseReceiptLogs", () => {
  it("keeps only GroupVault message logs and stamps the block", () => {
    const result = parseReceiptLogs(
      "receipt-1",
      ["noise", valid, valid],
      77,
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      logIndex: 1,
      blockHeight: 77,
      receiptId: "receipt-1",
    })
    expect(result[1]?.logIndex).toBe(2)
  })

  it("returns an empty array for a receipt with no GroupVault logs", () => {
    expect(parseReceiptLogs("r", ["noise"], 1)).toEqual([])
  })
})
