import { describe, expect, it } from "vitest"

import {
  formatFtAmount,
  formatNearAmount,
  parseFtToBaseUnits,
  parseNearToYocto,
} from "./format"

describe("near and FT display", () => {
  it("formats CONVERT_DEPOSIT as human NEAR", () => {
    expect(formatNearAmount("10000000000000000000000000")).toBe("10")
  })

  it("round-trips a human NEAR input without floating point", () => {
    expect(parseNearToYocto("0.5")).toBe("500000000000000000000000")
    expect(parseNearToYocto("10")).toBe("10000000000000000000000000")
    expect(formatNearAmount(parseNearToYocto("0.5"))).toBe("0.5")
  })

  it("formats the six-decimal join FT", () => {
    expect(formatFtAmount("1000000", 6)).toBe("1")
    expect(formatFtAmount("250000", 6)).toBe("0.25")
    expect(formatFtAmount(1000000n)).toBe("1")
    expect(formatFtAmount("1000000", 6)).not.toBe("1000000")
  })

  it("parses FT input into exact base units", () => {
    expect(parseFtToBaseUnits("1")).toBe("1000000")
    expect(parseFtToBaseUnits("0.25")).toBe("250000")
    expect(parseFtToBaseUnits("1.25")).toBe("1250000")
    expect(parseFtToBaseUnits("0.000001")).toBe("1")
  })

  it("rejects precision that would silently change the submitted amount", () => {
    expect(() => parseNearToYocto("0.0000000000000000000000001")).toThrow()
    expect(() => parseFtToBaseUnits("0.0000001")).toThrow()
  })

  it("rejects empty, non-digit, negative, exponent and malformed values", () => {
    for (const bad of ["", " ", "abc", "-1", "+1", "1e3", "1.2.3", ".5", "1."]) {
      expect(() => parseNearToYocto(bad)).toThrow()
      expect(() => parseFtToBaseUnits(bad)).toThrow()
    }
    for (const bad of ["", " ", "abc", "-1", "1e24", "1.5"]) {
      expect(() => formatNearAmount(bad)).toThrow()
    }
    expect(() => formatNearAmount(-1n)).toThrow()
    expect(() => formatFtAmount("-1000000")).toThrow()
  })

  it("handles zero and leading zeros without floating point", () => {
    expect(parseNearToYocto("0")).toBe("0")
    expect(parseNearToYocto("000.5")).toBe("500000000000000000000000")
    expect(formatNearAmount("0")).toBe("0")
    expect(parseFtToBaseUnits("00.5")).toBe("500000")
    expect(formatFtAmount("0")).toBe("0")
  })

  it("truncates display only and never for submitted input", () => {
    expect(formatNearAmount("1500000000000000000000000", 2)).toBe("1.5")
    expect(formatNearAmount("1234567890123456789012345", 4)).toBe("1.2345")
    expect(parseNearToYocto("1.234567890123456789012345")).toBe(
      "1234567890123456789012345",
    )
    expect(formatFtAmount("1234567", 6, 2)).toBe("1.23")
    expect(parseFtToBaseUnits("1.234567")).toBe("1234567")
  })
})
