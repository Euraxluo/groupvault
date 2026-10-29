import {
  DemoApiError,
  createFundedDemoAccount,
  demoJson,
  guardDemoRequest,
} from "@/lib/near/demo-server"

export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(request: Request): Promise<Response> {
  const guard = guardDemoRequest(request)
  if (!guard.ok) {
    return demoJson({ error: guard.error }, { status: guard.status })
  }

  try {
    const account = await createFundedDemoAccount()
    return demoJson(account)
  } catch (reason) {
    if (reason instanceof DemoApiError) {
      return demoJson(
        { funded: reason.funded ?? false, error: reason.message },
        { status: reason.status },
      )
    }
    return demoJson(
      {
        funded: false,
        error: "演示账号创建失败，请重试或手动贴 key",
      },
      { status: 502 },
    )
  }
}
