// server/api/user.ts
import { upstoxGet as _upstoxGet, upstoxPut as _upstoxPut, upstoxPost as _upstoxPost } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/user/profile ---
export async function handleGetProfile(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/user/profile"))
}

// --- GET /api/v1/upstox/user/funds-and-margin (v3) ---
export async function handleGetFundsAndMargin(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet("/user/get-funds-and-margin", undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/user/funds-and-margin-v2 ---
export async function handleGetFundsAndMarginV2(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/user/get-funds-and-margin", req))
  )
}

// --- GET /api/v1/upstox/user/ip ---
export async function handleGetIp(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/user/ip"))
}

// --- PUT /api/v1/upstox/user/ip ---
export async function handleUpdateIp(
  req: Request,
  upstoxPut: typeof _upstoxPut = _upstoxPut
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPut("/user/ip", body))
}

// --- GET /api/v1/upstox/user/kill-switch ---
export async function handleGetKillSwitch(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/user/kill-switch"))
}

// --- POST /api/v1/upstox/user/kill-switch ---
export async function handlePostKillSwitch(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/user/kill-switch", body))
}
