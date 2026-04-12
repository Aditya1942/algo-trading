// server/shared/upstox.ts
import { UpstoxError } from "./types"
import { getValidToken as _getValidToken } from "../modules/auth/index"

const BASE_URL = "https://api.upstox.com/v2"

export async function upstoxGet<T>(
  path: string,
  getToken: () => Promise<string> = _getValidToken
): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new UpstoxError(res.status, body)
  }
  return res.json() as Promise<T>
}
