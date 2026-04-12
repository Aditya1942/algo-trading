// server/shared/types.ts

export interface Token {
  id: number
  access_token: string
  refresh_token: string | null
  expires_at: number  // unix epoch seconds
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = "AuthError"
  }
}

export class UpstoxError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Upstox API error ${status}`)
    this.name = "UpstoxError"
  }
}
