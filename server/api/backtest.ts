// server/api/backtest.ts — HTTP handlers for backtest + strategies
import { addDynamicRoute } from './_router'
import { runBacktest, listBacktestRuns, getBacktestRun } from '../modules/backtest'
import { listStrategies } from '../modules/strategy'

// POST /api/v1/backtest/run
export async function handleRunBacktest(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const result = await runBacktest(body)
    return Response.json({ data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 400 })
  }
}

// GET /api/v1/backtest/history
export function handleGetBacktestHistory(_req: Request): Response {
  const runs = listBacktestRuns()
  return Response.json({ data: runs })
}

// GET /api/v1/backtest/history/:id (dynamic route)
export function handleGetBacktestRun(_req: Request, params: Record<string, string>): Response {
  const id = Number(params.id)
  if (isNaN(id)) {
    return Response.json({ error: 'invalid id' }, { status: 400 })
  }
  const result = getBacktestRun(id)
  if (!result) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ data: result })
}

// GET /api/v1/strategies
export function handleListStrategies(_req: Request): Response {
  const strategies = listStrategies()
  return Response.json({ data: strategies })
}

// Register dynamic (parameterized) routes
export function registerBacktestRoutes(): void {
  addDynamicRoute('GET', '/api/v1/backtest/history/:id', handleGetBacktestRun)
}
