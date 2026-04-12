// server/api/auth.ts
import { buildLoginUrl, consumeState, exchangeCode } from "../modules/auth/index"
import { upstoxDelete as _upstoxDelete, upstoxPost as _upstoxPost } from "../shared/upstox"
import { AuthError } from "../shared/types"
import { proxyUpstox } from "./_handle"

export async function handleLogin(_req: Request): Promise<Response> {
  const url = buildLoginUrl()
  return Response.redirect(url, 302)
}

export async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const clientBase = "http://localhost:3000"

  // Handle OAuth error response (e.g. user denied access)
  const oauthError = url.searchParams.get("error")
  if (oauthError) {
    const desc = url.searchParams.get("error_description") ?? ""
    return Response.redirect(
      `${clientBase}/auth/callback?error=${encodeURIComponent(oauthError)}&description=${encodeURIComponent(desc)}`,
      302,
    )
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    return Response.redirect(`${clientBase}/auth/callback?error=missing_params`, 302)
  }
  if (!consumeState(state)) {
    return Response.redirect(`${clientBase}/auth/callback?error=invalid_state`, 302)
  }
  try {
    await exchangeCode(code)
    return Response.redirect(`${clientBase}/auth/callback?success=true`, 302)
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.redirect(
        `${clientBase}/auth/callback?error=${encodeURIComponent(err.code)}&message=${encodeURIComponent(err.message)}`,
        302,
      )
    }
    const msg = err instanceof Error ? err.message : "unknown"
    console.error("[auth/callback] unexpected error:", err)
    return Response.redirect(
      `${clientBase}/auth/callback?error=unknown&description=${encodeURIComponent(msg)}`,
      302,
    )
  }
}

// --- DELETE /api/v1/upstox/auth/logout --- (Upstox-side logout)
export async function handleUpstoxLogout(
  _req: Request,
  upstoxDelete: typeof _upstoxDelete = _upstoxDelete
): Promise<Response> {
  return proxyUpstox(() => upstoxDelete("/logout"))
}

// --- POST /api/v1/upstox/auth/webhook-token/:client_id --- (dynamic route)
export async function handleWebhookToken(
  _req: Request,
  params: Record<string, string>,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const { client_id } = params
  return proxyUpstox(() =>
    upstoxPost(`/login/auth/token/request/${client_id}`, {}, undefined, { version: 3 })
  )
}
