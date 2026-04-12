// server/api/feed.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { proxyUpstox } from "./_handle"

// --- GET /api/v1/upstox/feed/market-data-feed ---
export async function handleGetMarketDataFeed(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/feed/market-data-feed"))
}

// --- GET /api/v1/upstox/feed/market-data-feed/authorize ---
export async function handleAuthorizeMarketDataFeed(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/feed/market-data-feed/authorize"))
}

// --- GET /api/v1/upstox/feed/portfolio-stream-feed ---
export async function handleGetPortfolioStreamFeed(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/feed/portfolio-stream-feed"))
}

// --- GET /api/v1/upstox/feed/portfolio-stream-feed/authorize ---
export async function handleAuthorizePortfolioStreamFeed(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/feed/portfolio-stream-feed/authorize"))
}
