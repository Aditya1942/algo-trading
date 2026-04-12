// server/api/expired-instruments.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"
import { addDynamicRoute } from "./_router"

// --- GET /api/v1/upstox/expired-instruments/expiries ---
export async function handleGetExpiries(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/expired-instruments/expiries", req))
  )
}

// --- GET /api/v1/upstox/expired-instruments/future/contract ---
export async function handleGetExpiredFutureContract(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/expired-instruments/future/contract", req))
  )
}

// --- GET /api/v1/upstox/expired-instruments/option/contract ---
export async function handleGetExpiredOptionContract(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/expired-instruments/option/contract", req))
  )
}

// --- Dynamic: GET /api/v1/upstox/expired-instruments/historical-candle/:key/:interval/:to/:from ---
export async function handleExpiredHistoricalCandle(
  _req: Request,
  params: Record<string, string>,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  const { key, interval, to, from } = params
  return proxyUpstox(() =>
    upstoxGet(`/expired-instruments/historical-candle/${encodeURIComponent(key)}/${interval}/${to}/${from}`)
  )
}

// Register dynamic routes
export function registerExpiredInstrumentRoutes(): void {
  addDynamicRoute(
    "GET",
    "/api/v1/upstox/expired-instruments/historical-candle/:key/:interval/:to/:from",
    handleExpiredHistoricalCandle
  )
}
