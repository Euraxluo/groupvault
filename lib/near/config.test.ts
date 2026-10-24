import { afterEach, describe, expect, it, vi } from "vitest"

import { getNearConfig } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("browser-visible NEXT_PUBLIC config", () => {
  it("reads each public value with a static key", () => {
    vi.stubEnv("NEXT_PUBLIC_GROUPVAULT_CONTRACT", "gv.testnet")
    vi.stubEnv("NEXT_PUBLIC_JOIN_FT", "ft.testnet")
    const config = getNearConfig()
    expect(config.groupVaultContractId).toBe("gv.testnet")
    expect(config.joinFtContractId).toBe("ft.testnet")
    expect(config.factoryId).toBe("sputnikv2.testnet")
  })

  it("rejects an unsupported network", () => {
    vi.stubEnv("NEXT_PUBLIC_NEAR_NETWORK", "devnet")
    expect(() => getNearConfig()).toThrow(/Unsupported NEXT_PUBLIC_NEAR_NETWORK/)
  })
})
