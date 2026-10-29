import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const submit = vi.fn()
const refresh = vi.fn()
const push = vi.fn()
let state: Record<string, unknown>

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
  it("shows human 10 NEAR and no threshold ceremony language", async () => {
    await page()
    expect(await screen.findByText("约 10 NEAR")).toBeInTheDocument()
    expect(screen.getByText(/群主 1 签/)).toBeInTheDocument()
    expect(screen.queryByText(/10000000000000000000000000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/yoctoNEAR/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sputnik/)).not.toBeInTheDocument()
    expect(screen.queryByText(/threshold/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/DKG participant/i)).not.toBeInTheDocument()
  })

  it("routes to treasury with the exact confirmed DAO id", async () => {
    submit.mockResolvedValue("builders.sputnikv2.testnet")
    await page()
    fireEvent.change(await screen.findByLabelText("DAO 名称"), {
      target: { value: "builders" },
    })
    fireEvent.click(screen.getByRole("button", { name: "确认升级" }))
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        "builders",
        "付费群升级为 DAO",
      ),
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/dao/builders.sputnikv2.testnet/treasury?from=convert&groupId=3",
      ),
    )
  })

  it("never pushes when the confirmed id is missing", async () => {
    submit.mockRejectedValue(new Error("升级确认超时：尚未读到链上 DAO ID"))
    state = { ...state, error: "升级确认超时：尚未读到链上 DAO ID" }
    await page()
    fireEvent.click(screen.getByRole("button", { name: "确认升级" }))
    await waitFor(() => expect(submit).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it("rejects invalid DAO names before the wallet", async () => {
    await page()
    fireEvent.change(await screen.findByLabelText("DAO 名称"), {
      target: { value: "Bad.Name" },
    })
    fireEvent.click(screen.getByRole("button", { name: "确认升级" }))
    expect(await screen.findByText(/只能包含/)).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("shows pending without inventing dao_id", async () => {
    state = { ...state, canConvert: false, pending: true, reason: "A Convert is already pending" }
    await page()
    expect(await screen.findByText(/升级确认中/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "确认升级" })).toBeDisabled()
    expect(screen.queryByText(/sputnikv2.testnet/)).not.toBeInTheDocument()
  })

  it("links to DAO setup only after a real dao_id", async () => {
    state = {
      ...state,
      canConvert: false,
      group: { ...(state.group as object), dao_id: "builders.sputnikv2.testnet" },
    }
    await page()
    expect(await screen.findByText("已是 DAO")).toBeInTheDocument()
    expect(screen.getByText(/builders.sputnikv2.testnet/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /查看金库/ })).toHaveAttribute(
      "href",
      "/dao/builders.sputnikv2.testnet/treasury?from=convert&groupId=3",
    )
    expect(screen.queryByRole("button", { name: "确认升级" })).not.toBeInTheDocument()
  })
})
