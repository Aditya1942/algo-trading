// server/api/instruments.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { upsertInstruments } from "../modules/market-data"

// --- GET /api/v1/upstox/instruments/search ---
export async function handleSearchInstruments(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const result = await upstoxGet(forwardQuery("/instruments/search", req)) as {
      status: string
      data: Array<{
        instrument_key: string
        trading_symbol?: string
        name?: string
        exchange?: string
        instrument_type?: string
        [key: string]: unknown
      }>
    }

    // Cache results in background — don't block response
    if (result?.data?.length > 0) {
      try {
        upsertInstruments(
          result.data.map((inst) => ({
            instrument_key: inst.instrument_key,
            trading_symbol: inst.trading_symbol ?? '',
            name: inst.name ?? '',
            exchange: inst.exchange ?? '',
            instrument_type: inst.instrument_type ?? '',
            raw_data: JSON.stringify(inst),
          })),
        )
      } catch {
        // Don't fail the search if caching fails
        console.error('[instruments] cache upsert failed')
      }
    }

    return Response.json(result)
  } catch (err) {
    const { AuthError, UpstoxError } = await import("../shared/types")
    if (err instanceof AuthError)
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    if (err instanceof UpstoxError)
      return Response.json(err.body, { status: err.status })
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
