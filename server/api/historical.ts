// server/api/historical.ts — dynamic-route handlers for historical candle data
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { proxyUpstox } from "./_handle"
import { addDynamicRoute } from "./_router"

type Deps = { upstoxGet: typeof _upstoxGet }
const defaultDeps: Deps = { upstoxGet: _upstoxGet }

// --- v2 intraday: /historical-candle/intraday/:key/:interval ---
export async function handleIntradayCandle(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, interval } = params
  return proxyUpstox(() =>
    deps.upstoxGet(`/historical-candle/intraday/${encodeURIComponent(key)}/${interval}`)
  )
}

// --- v2: /historical-candle/:key/:interval/:to ---
export async function handleHistoricalCandleTo(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, interval, to } = params
  return proxyUpstox(() =>
    deps.upstoxGet(`/historical-candle/${encodeURIComponent(key)}/${interval}/${to}`)
  )
}

// --- v2: /historical-candle/:key/:interval/:to/:from ---
export async function handleHistoricalCandleRange(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, interval, to, from } = params
  return proxyUpstox(() =>
    deps.upstoxGet(`/historical-candle/${encodeURIComponent(key)}/${interval}/${to}/${from}`)
  )
}

// --- v3 intraday: /historical-candle/intraday/:key/:unit/:interval ---
export async function handleIntradayCandleV3(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, unit, interval } = params
  return proxyUpstox(() =>
    deps.upstoxGet(
      `/historical-candle/intraday/${encodeURIComponent(key)}/${unit}/${interval}`,
      undefined,
      { version: 3 }
    )
  )
}

// --- v3: /historical-candle/:key/:unit/:interval/:to ---
export async function handleHistoricalCandleToV3(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, unit, interval, to } = params
  return proxyUpstox(() =>
    deps.upstoxGet(
      `/historical-candle/${encodeURIComponent(key)}/${unit}/${interval}/${to}`,
      undefined,
      { version: 3 }
    )
  )
}

// --- v3: /historical-candle/:key/:unit/:interval/:to/:from ---
export async function handleHistoricalCandleRangeV3(
  _req: Request,
  params: Record<string, string>,
  deps: Deps = defaultDeps
): Promise<Response> {
  const { key, unit, interval, to, from } = params
  return proxyUpstox(() =>
    deps.upstoxGet(
      `/historical-candle/${encodeURIComponent(key)}/${unit}/${interval}/${to}/${from}`,
      undefined,
      { version: 3 }
    )
  )
}

// Register all dynamic routes
export function registerHistoricalRoutes(): void {
  // v2
  addDynamicRoute("GET", "/api/v1/upstox/historical-candle/intraday/:key/:interval", handleIntradayCandle)
  addDynamicRoute("GET", "/api/v1/upstox/historical-candle/:key/:interval/:to", handleHistoricalCandleTo)
  addDynamicRoute("GET", "/api/v1/upstox/historical-candle/:key/:interval/:to/:from", handleHistoricalCandleRange)
  // v3
  addDynamicRoute("GET", "/api/v1/upstox/v3/historical-candle/intraday/:key/:unit/:interval", handleIntradayCandleV3)
  addDynamicRoute("GET", "/api/v1/upstox/v3/historical-candle/:key/:unit/:interval/:to", handleHistoricalCandleToV3)
  addDynamicRoute("GET", "/api/v1/upstox/v3/historical-candle/:key/:unit/:interval/:to/:from", handleHistoricalCandleRangeV3)
}
