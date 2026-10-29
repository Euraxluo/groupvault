const NEAR_DECIMALS = 24
const NEAR_SCALE = 10n ** BigInt(NEAR_DECIMALS)

const UNSIGNED_DECIMAL = /^\d+(?:\.\d+)?$/
const UNSIGNED_INTEGER = /^\d+$/

function toBaseUnits(value: string | bigint, label: string): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error(`${label} cannot be negative`)
    return value
  }
  const trimmed = value.trim()
  if (!UNSIGNED_INTEGER.test(trimmed)) {
    throw new Error(`${label} must be an unsigned integer string`)
  }
  return BigInt(trimmed)
}

function assertDigits(digits: number, decimals: number): void {
  if (!Number.isInteger(digits) || digits < 0 || digits > decimals) {
    throw new Error(`digits must be an integer between 0 and ${decimals}`)
  }
}

function trimFraction(fraction: string): string {
  return fraction.replace(/0+$/, "")
}

/** Display NEAR from yoctoNEAR without floating point. Truncates for display only. */
export function formatNearAmount(value: string | bigint, digits = 4): string {
  assertDigits(digits, NEAR_DECIMALS)
  const amount = toBaseUnits(value, "NEAR amount")
  const whole = amount / NEAR_SCALE
  const fraction = amount % NEAR_SCALE
  if (fraction === 0n) return whole.toString()
  const shown = trimFraction(
    fraction.toString().padStart(NEAR_DECIMALS, "0").slice(0, digits),
  )
  return shown ? `${whole}.${shown}` : whole.toString()
}

/** Parse a human NEAR input into yoctoNEAR; excess precision is rejected. */
export function parseNearToYocto(input: string): string {
  const value = input.trim()
  if (!UNSIGNED_DECIMAL.test(value)) {
    throw new Error("Invalid NEAR amount")
  }
  const [whole, fraction = ""] = value.split(".")
  if (fraction.length > NEAR_DECIMALS) {
    throw new Error(`NEAR amount supports at most ${NEAR_DECIMALS} decimals`)
  }
  const padded = fraction.padEnd(NEAR_DECIMALS, "0")
  return (BigInt(whole) * NEAR_SCALE + BigInt(padded || "0")).toString()
}

/** Display six-decimal NEP-141 base units (join fee). Truncates for display only. */
export function formatFtAmount(
  value: string | bigint,
  decimals = 6,
  digits = decimals,
): string {
  assertDigits(decimals, NEAR_DECIMALS)
  assertDigits(digits, decimals)
  const scale = 10n ** BigInt(decimals)
  const amount = toBaseUnits(value, "FT amount")
  const whole = amount / scale
  const fraction = amount % scale
  if (fraction === 0n) return whole.toString()
  const shown = trimFraction(
    fraction.toString().padStart(decimals, "0").slice(0, digits),
  )
  return shown ? `${whole}.${shown}` : whole.toString()
}

/** Parse a human FT amount into base units; excess precision is rejected. */
export function parseFtToBaseUnits(input: string, decimals = 6): string {
  assertDigits(decimals, NEAR_DECIMALS)
  const value = input.trim()
  if (!UNSIGNED_DECIMAL.test(value)) {
    throw new Error("Invalid FT amount")
  }
  const [whole, fraction = ""] = value.split(".")
  if (fraction.length > decimals) {
    throw new Error(`FT amount supports at most ${decimals} decimals`)
  }
  const scale = 10n ** BigInt(decimals)
  const padded = fraction.padEnd(decimals, "0")
  return (BigInt(whole) * scale + BigInt(padded || "0")).toString()
}
