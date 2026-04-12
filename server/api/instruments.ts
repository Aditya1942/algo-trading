// server/api/instruments.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/instruments/search ---
export async function handleSearchInstruments(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/instruments/search", req))
  )
}
