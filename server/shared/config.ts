// server/shared/config.ts

export const config = {
  upstoxClientId: process.env.UPSTOX_CLIENT_ID ?? "",
  upstoxClientSecret: process.env.UPSTOX_CLIENT_SECRET ?? "",
  upstoxRedirectUri: process.env.UPSTOX_REDIRECT_URI ?? "http://localhost:8081/auth/callback",
  port: 8081,
} as const
