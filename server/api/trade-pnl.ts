// server/api/trade-pnl.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/trade/pnl/charges ---
export async function handleGetPnlCharges(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/trade/profit-loss/charges", req))
  )
}

// --- GET /api/v1/upstox/trade/pnl/data ---
export async function handleGetPnlData(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/trade/profit-loss/data", req))
  )
}

// --- GET /api/v1/upstox/trade/pnl/metadata ---
export async function handleGetPnlMetadata(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/trade/profit-loss/metadata", req))
  )
}
