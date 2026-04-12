// server/shared/config.ts

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const config = {
  upstoxClientId: required("UPSTOX_CLIENT_ID"),
  upstoxClientSecret: required("UPSTOX_CLIENT_SECRET"),
  upstoxRedirectUri: process.env.UPSTOX_REDIRECT_URI ?? "http://localhost:8081/auth/callback",
  port: 8081,
} as const
