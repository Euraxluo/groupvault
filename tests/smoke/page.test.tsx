import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Home from "@/app/page"

describe("GroupVault landing shell", () => {
  it("renders the product boundary without fabricated groups", () => {
    render(<Home />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Paid group → chat → Convert → stake/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no backend signing/i)).toBeInTheDocument()
    expect(screen.getByText(/Public on-chain logs/i)).toBeInTheDocument()
    expect(screen.queryByText(/Team Treasury \(Sui MultiSig\)/i)).not.toBeInTheDocument()
  })
})
