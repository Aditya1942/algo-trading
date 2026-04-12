// server/api/auth.ts
import { buildLoginUrl, consumeState, exchangeCode } from "../modules/auth/index"
import { AuthError } from "../shared/types"

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
    return Response.redirect(`${clientBase}/auth/callback?error=unknown`, 302)
  }
}
