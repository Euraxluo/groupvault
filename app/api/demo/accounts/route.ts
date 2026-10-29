import {
  demoJson,
  guardDemoRequest,
  listDemoAccountIds,
} from "@/lib/near/demo-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  const guard = guardDemoRequest(request)
  if (!guard.ok) {
    return demoJson({ error: guard.error }, { status: guard.status })
  }

  try {
    const accounts = await listDemoAccountIds()
    return demoJson({ accounts })
  } catch (reason) {
    return demoJson(
      {
        error:
          reason instanceof Error ? reason.message : "无法读取本机演示账号",
      },
      { status: 500 },
    )
  }
}
