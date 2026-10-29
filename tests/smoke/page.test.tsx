import { beforeEach, describe, expect, it, vi } from "vitest"

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))

vi.mock("next/navigation", () => ({ redirect }))

import DaoEntryPage from "@/app/dao/page"
import DemoStoryPage from "@/app/demo/page"
import GroupsPage from "@/app/groups/page"
import Home from "@/app/page"

describe("Jobs IA legacy entry redirects", () => {
  beforeEach(() => {
    redirect.mockClear()
  })

  it.each([
    ["/", Home],
    ["/groups", GroupsPage],
    ["/dao", DaoEntryPage],
    ["/demo", DemoStoryPage],
  ])("redirects %s to /chat", (_path, Page) => {
    Page()
    expect(redirect).toHaveBeenCalledWith("/chat")
  })
})
