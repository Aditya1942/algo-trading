// server/shared/upstox.ts
import { UpstoxError } from "./types"
import { getValidToken as _getValidToken } from "../modules/auth/index"

const BASE_V2 = "https://api.upstox.com/v2"
const BASE_V3 = "https://api.upstox.com/v3"

export type UpstoxGetOptions = {
  /** v3 endpoints require `Api-Version: 3.0` and use host `.../v3/...` */
  version?: 2 | 3
}

export async function upstoxGet<T>(
  path: string,
  getToken: () => Promise<string> = _getValidToken,
  options?: UpstoxGetOptions
): Promise<T> {
  const token = await getToken()
  const isV3 = options?.version === 3
  const url = isV3 ? `${BASE_V3}${path}` : `${BASE_V2}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }
  if (isV3) headers["Api-Version"] = "3.0"

  const res = await fetch(url, {
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new UpstoxError(res.status, body)
  }
  return res.json() as Promise<T>
}
