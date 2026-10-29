import {
  DemoApiError,
  demoJson,
  guardDemoRequest,
  isValidDemoAccountId,
  loadDemoKeypair,
} from "@/lib/near/demo-server"

export const runtime = "nodejs"

interface KeypairRequestBody {
  accountId?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const guard = guardDemoRequest(request)
  if (!guard.ok) {
    return demoJson({ error: guard.error }, { status: guard.status })
  }

  let body: KeypairRequestBody
  try {
    body = (await request.json()) as KeypairRequestBody
  } catch {
    return demoJson({ error: "请求体必须是 JSON" }, { status: 400 })
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.accountId !== "string" ||
    !isValidDemoAccountId(body.accountId)
  ) {
    return demoJson({ error: "账号 ID 无效" }, { status: 400 })
  }

  try {
    const keypair = await loadDemoKeypair(body.accountId)
    return demoJson(keypair)
  } catch (reason) {
    if (reason instanceof DemoApiError) {
      return demoJson(
        { error: reason.message },
        { status: reason.status },
      )
    }
    return demoJson({ error: "无法读取本机演示账号凭据" }, { status: 500 })
  }
}
