import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const submit = vi.fn()
const refresh = vi.fn()
let state: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}))

vi.mock("@/hooks/use-convert", () => ({
  useConvert: () => state,
}))

vi.mock("@/lib/near/deposits", () => ({
  CONVERT_DEPOSIT: "10000000000000000000000000",
}))

import { ConvertForm } from "@/components/convert-form"

async function page() {
  return render(<ConvertForm groupId={3} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  state = {
    group: {
      id: 3,
      owner: "alice.testnet",
      name: "Builders",
      description: "",
      join_fee: "1",
      join_ft: "ft.testnet",
      member_count: 2,
      dao_id: null,
      convert_pending: false,
      created_at: 1,
    },
    canConvert: true,
    reason: null,
    pending: false,
    submitting: false,
    error: null,
    submit,
    refresh,
  }
})

describe("Convert screen", () => {
  it("states that Convert is not a threshold ceremony", async () => {
    await page()
    expect(await screen.findByText(/not a threshold ceremony/i)).toBeInTheDocument()
    expect(screen.queryByText(/DKG participant/i)).not.toBeInTheDocument()
  })

  it("submits one owner Convert with the unqualified DAO name", async () => {
    submit.mockResolvedValue(undefined)
    await page()
    fireEvent.change(await screen.findByLabelText("DAO name"), {
      target: { value: "builders" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Convert with wallet/i }))
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        "builders",
        "Paid group converting to a DAO",
      ),
    )
  })

  it("rejects invalid DAO names before the wallet", async () => {
    await page()
    fireEvent.change(await screen.findByLabelText("DAO name"), {
      target: { value: "Bad.Name" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Convert with wallet/i }))
    expect(await screen.findByText(/lowercase letters/i)).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it("shows pending without inventing dao_id", async () => {
    state = { ...state, canConvert: false, pending: true, reason: "A Convert is already pending" }
    await page()
    expect(await screen.findByText(/Conversion pending/i)).toBeInTheDocument()
    expect(screen.queryByText(/sputnikv2.testnet/)).not.toBeInTheDocument()
  })

  it("links to DAO setup only after a real dao_id", async () => {
    state = {
      ...state,
      canConvert: false,
      group: { ...(state.group as object), dao_id: "builders.sputnikv2.testnet" },
    }
    await page()
    expect(await screen.findByText(/builders.sputnikv2.testnet/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open DAO setup/i })).toHaveAttribute(
      "href",
      "/dao/builders.sputnikv2.testnet",
    )
  })
})
