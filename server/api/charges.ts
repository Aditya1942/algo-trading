// server/api/charges.ts
import { upstoxGet as _upstoxGet, upstoxPost as _upstoxPost } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/charges/brokerage ---
export async function handleGetBrokerage(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/charges/brokerage", req))
  )
}

// --- GET /api/v1/upstox/charges/historical-trades ---
export async function handleGetHistoricalCharges(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/charges/historical-trades", req))
  )
}

// --- POST /api/v1/upstox/charges/margin ---
export async function handlePostMarginCharges(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/charges/margin", body))
}
