// server/shared/upstox.ts
import { UpstoxError } from "./types"
import { getValidToken as _getValidToken } from "../modules/auth/index"

const BASE_V2 = "https://api.upstox.com/v2"
const BASE_V3 = "https://api.upstox.com/v3"

export type UpstoxRequestOptions = {
  /** v3 endpoints require `Api-Version: 3.0` and use host `.../v3/...` */
  version?: 2 | 3
}

/** @deprecated Use UpstoxRequestOptions */
export type UpstoxGetOptions = UpstoxRequestOptions

async function upstoxFetch<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  getToken: () => Promise<string>,
  options?: UpstoxRequestOptions
): Promise<T> {
  const token = await getToken()
  const isV3 = options?.version === 3
  const url = isV3 ? `${BASE_V3}${path}` : `${BASE_V2}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }
  if (isV3) headers["Api-Version"] = "3.0"
  if (body !== undefined) headers["Content-Type"] = "application/json"

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}))
    throw new UpstoxError(res.status, resBody)
  }
  return res.json() as Promise<T>
}

export async function upstoxGet<T>(
  path: string,
  getToken: () => Promise<string> = _getValidToken,
  options?: UpstoxRequestOptions
): Promise<T> {
  return upstoxFetch<T>("GET", path, undefined, getToken, options)
}

export async function upstoxPost<T>(
  path: string,
  body: unknown,
  getToken: () => Promise<string> = _getValidToken,
  options?: UpstoxRequestOptions
): Promise<T> {
  return upstoxFetch<T>("POST", path, body, getToken, options)
}

export async function upstoxPut<T>(
  path: string,
  body: unknown,
  getToken: () => Promise<string> = _getValidToken,
  options?: UpstoxRequestOptions
): Promise<T> {
  return upstoxFetch<T>("PUT", path, body, getToken, options)
}

export async function upstoxDelete<T>(
  path: string,
  body?: unknown,
  getToken: () => Promise<string> = _getValidToken,
  options?: UpstoxRequestOptions
): Promise<T> {
  return upstoxFetch<T>("DELETE", path, body, getToken, options)
}
