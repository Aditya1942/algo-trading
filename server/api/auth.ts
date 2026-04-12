// server/api/auth.ts
import { buildLoginUrl, consumeState, exchangeCode } from "../modules/auth/index"
import { AuthError } from "../shared/types"

export async function handleLogin(_req: Request): Promise<Response> {
  const url = buildLoginUrl()
  return Response.redirect(url, 302)
}

export async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    return Response.json({ error: "missing_params" }, { status: 400 })
  }
  if (!consumeState(state)) {
    return Response.json({ error: "invalid_state" }, { status: 400 })
  }
  try {
    await exchangeCode(code)
    return Response.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
