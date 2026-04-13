// server/api/market-data.ts — HTTP handlers for market-data module
import { addDynamicRoute } from './_router'
import {
  listInstrumentsWithStats,
  getInstrument,
  addInstrument,
  removeInstrument,
  updateInstrumentStatus,
  queryCandlesAggregated,
  listTrackedInstrumentKeys,
} from '../modules/market-data'

// GET /api/v1/market-data/instruments/keys
export async function handleGetTrackedKeys(_req: Request): Promise<Response> {
  const keys = listTrackedInstrumentKeys()
  return Response.json({ data: keys })
}

// GET /api/v1/market-data/instruments
export async function handleListInstruments(_req: Request): Promise<Response> {
  const instruments = listInstrumentsWithStats()
  return Response.json({ data: instruments })
}

// POST /api/v1/market-data/instruments
export async function handleAddInstrument(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      instrument_key?: string
      name?: string
      exchange?: string
    }
    if (!body.instrument_key) {
      return Response.json({ error: 'instrument_key required' }, { status: 400 })
    }
    const instrument = addInstrument(body.instrument_key, body.name, body.exchange)
    return Response.json({ data: instrument }, { status: 201 })
  } catch (err: unknown) {
    // UNIQUE constraint = duplicate
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return Response.json({ error: 'instrument already tracked' }, { status: 409 })
    }
    throw err
  }
}

// DELETE /api/v1/market-data/instruments/:id
export async function handleDeleteInstrument(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const id = Number(params.id)
  const inst = getInstrument(id)
  if (!inst) return Response.json({ error: 'not_found' }, { status: 404 })
  removeInstrument(id)
  return Response.json({ ok: true })
}

// POST /api/v1/market-data/instruments/:id/pause
export async function handlePauseInstrument(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const id = Number(params.id)
  const inst = getInstrument(id)
  if (!inst) return Response.json({ error: 'not_found' }, { status: 404 })
  updateInstrumentStatus(id, 'paused')
  return Response.json({ ok: true })
}

// POST /api/v1/market-data/instruments/:id/resume
export async function handleResumeInstrument(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const id = Number(params.id)
  const inst = getInstrument(id)
  if (!inst) return Response.json({ error: 'not_found' }, { status: 404 })
  updateInstrumentStatus(id, 'active')
  return Response.json({ ok: true })
}

// GET /api/v1/market-data/instruments/:id/candles?from=&to=
export async function handleGetCandles(
  req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const id = Number(params.id)
  const inst = getInstrument(id)
  if (!inst) return Response.json({ error: 'not_found' }, { status: 404 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') ?? '2020-01-01'
  const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
  const interval = url.searchParams.get('interval') ?? '1d'
  if (interval !== '1d' && interval !== '1h' && interval !== '1m') {
    return Response.json({ error: 'invalid_interval', message: 'interval must be 1d, 1h, or 1m' }, { status: 400 })
  }
  const candles = queryCandlesAggregated(inst.instrument_key, from, to, interval)
  return Response.json({ data: candles })
}

// Register dynamic (parameterized) routes
export function registerMarketDataRoutes(): void {
  addDynamicRoute('DELETE', '/api/v1/market-data/instruments/:id', handleDeleteInstrument)
  addDynamicRoute('POST', '/api/v1/market-data/instruments/:id/pause', handlePauseInstrument)
  addDynamicRoute('POST', '/api/v1/market-data/instruments/:id/resume', handleResumeInstrument)
  addDynamicRoute('GET', '/api/v1/market-data/instruments/:id/candles', handleGetCandles)
}
