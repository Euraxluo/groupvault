import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Home from "@/app/page"

describe("GroupVault landing shell", () => {
  it("renders the product boundary without fabricated groups", () => {
    render(<Home />)

    expect(
      screen.getByRole("heading", { level: 1, name: /A group chat with a treasury/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No invented groups, balances, or messages/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Team Treasury \(Sui MultiSig\)/i)).not.toBeInTheDocument()
  })
})
