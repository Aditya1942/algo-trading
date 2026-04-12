// server/api/portfolio.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { proxyUpstox } from "./_handle"

export async function handleGetHoldings(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/portfolio/long-term-holdings"))
}
