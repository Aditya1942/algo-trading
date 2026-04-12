// server/api/portfolio.ts
import { upstoxGet as _upstoxGet, upstoxPut as _upstoxPut } from "../shared/upstox"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/portfolio/holdings ---
export async function handleGetHoldings(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/portfolio/long-term-holdings"))
}

// --- GET /api/v1/upstox/portfolio/positions ---
export async function handleGetPositions(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/portfolio/short-term-positions"))
}

// --- PUT /api/v1/upstox/portfolio/convert-position ---
export async function handleConvertPosition(
  req: Request,
  upstoxPut: typeof _upstoxPut = _upstoxPut
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPut("/portfolio/convert-position", body))
}

// --- GET /api/v1/upstox/v3/portfolio/mtf-positions ---
export async function handleGetMtfPositions(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet("/portfolio/mtf-positions", undefined, { version: 3 })
  )
}
