// server/api/options.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/option/chain ---
export async function handleGetOptionChain(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/option/chain", req))
  )
}

// --- GET /api/v1/upstox/option/contract ---
export async function handleGetOptionContract(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/option/contract", req))
  )
}
