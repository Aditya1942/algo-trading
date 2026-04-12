// server/modules/auth/index.ts
import { Database } from "bun:sqlite"
import { config } from "../../shared/config"
import { AuthError } from "../../shared/types"
import { getToken, upsertToken } from "./db"
import _db from "../../shared/db"

// In-memory state nonce store: state -> timestamp created
const stateStore = new Map<string, number>()
const STATE_TTL_MS = 10 * 60 * 1000  // 10 minutes

export function buildLoginUrl(): string {
  const state = crypto.randomUUID()
  stateStore.set(state, Date.now())
  const params = new URLSearchParams({
    client_id: config.upstoxClientId,
    redirect_uri: config.upstoxRedirectUri,
    response_type: "code",
    state,
  })
  return `https://api.upstox.com/v2/login/authorization/dialog?${params}`
}

export function consumeState(state: string): boolean {
  const ts = stateStore.get(state)
  if (!ts) return false
  stateStore.delete(state)
  if (Date.now() - ts > STATE_TTL_MS) return false
  return true
}

export async function exchangeCode(code: string, db: Database = _db): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.upstoxClientId,
    client_secret: config.upstoxClientSecret,
    redirect_uri: config.upstoxRedirectUri,
    grant_type: "authorization_code",
  })
  const res = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new AuthError("exchange_failed", JSON.stringify(errBody))
  }
  const data = await res.json() as Record<string, unknown>
  console.log("[auth] token response keys:", Object.keys(data))

  const accessToken = data.access_token as string
  if (!accessToken) throw new AuthError("exchange_failed", "No access_token in response")

  // Upstox may return expires_in (seconds) or expiry time differently
  const expiresIn = (data.expires_in ?? data.expires ?? 86400) as number
  upsertToken(
    {
      access_token: accessToken,
      refresh_token: (data.refresh_token as string) ?? null,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    },
    db
  )
  return accessToken
}

export async function getValidToken(db: Database = _db): Promise<string> {
  const token = getToken(db)
  if (!token) throw new AuthError("not_authenticated", "Visit /auth/login first")

  const nowSec = Math.floor(Date.now() / 1000)
  if (token.expires_at - nowSec > 300) return token.access_token

  // Refresh
  if (!token.refresh_token) throw new AuthError("not_authenticated", "No refresh token — re-authenticate")

  const body = new URLSearchParams({
    refresh_token: token.refresh_token,
    client_id: config.upstoxClientId,
    client_secret: config.upstoxClientSecret,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new AuthError("token_refresh_failed", JSON.stringify(errBody))
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  upsertToken(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
    db
  )
  return data.access_token
}
