// server/api/market.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"
import { addDynamicRoute } from "./_router"

// --- GET /api/v1/upstox/market-quote/ltp ---
export async function handleGetLtp(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/ltp", req))
  )
}

// --- GET /api/v1/upstox/market-quote/ohlc ---
export async function handleGetOhlc(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/ohlc", req))
  )
}

// --- GET /api/v1/upstox/market-quote/quotes ---
export async function handleGetQuotes(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/quotes", req))
  )
}

// --- GET /api/v1/upstox/v3/market-quote/ltp ---
export async function handleGetLtpV3(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/ltp", req), undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/v3/market-quote/ohlc ---
export async function handleGetOhlcV3(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/ohlc", req), undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/v3/market-quote/option-greek ---
export async function handleGetOptionGreek(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/market-quote/option-greek", req), undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/market/holidays ---
export async function handleGetHolidays(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/market/holidays"))
}

// --- Dynamic: GET /api/v1/upstox/market/holidays/:date ---
export async function handleGetHolidaysByDate(
  _req: Request,
  params: Record<string, string>,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet(`/market/holidays/${params.date}`))
}

// --- Dynamic: GET /api/v1/upstox/market/timings/:date ---
export async function handleGetMarketTimings(
  _req: Request,
  params: Record<string, string>,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet(`/market/timings/${params.date}`))
}

// --- Dynamic: GET /api/v1/upstox/market/status/:exchange ---
export async function handleGetMarketStatus(
  _req: Request,
  params: Record<string, string>,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet(`/market/status/${params.exchange}`))
}

// Register dynamic routes
export function registerMarketRoutes(): void {
  addDynamicRoute("GET", "/api/v1/upstox/market/holidays/:date", handleGetHolidaysByDate)
  addDynamicRoute("GET", "/api/v1/upstox/market/timings/:date", handleGetMarketTimings)
  addDynamicRoute("GET", "/api/v1/upstox/market/status/:exchange", handleGetMarketStatus)
}
