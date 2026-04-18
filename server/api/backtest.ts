// server/api/backtest.ts — HTTP handlers for backtest + strategies
import { addDynamicRoute } from './_router'
import type { BacktestConfig } from '../modules/backtest'
import { runBacktest, listBacktestRuns, getBacktestRun } from '../modules/backtest'
import { listStrategies, listCustom } from '../modules/strategy'
import { validateRunConfig } from '../shared/contracts/index.ts'
import defaultDb from '../shared/db.ts'

// POST /api/v1/backtest/run
export async function handleRunBacktest(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const validation = validateRunConfig(body)
    if (!validation.ok) {
      return Response.json(
        { error: 'invalid run config', details: validation.errors },
        { status: 400 },
      )
    }

    if (validation.value.mode !== 'backtest') {
      return Response.json(
        { error: 'Only backtest mode is supported by this endpoint right now' },
        { status: 400 },
      )
    }

    const backtestValue = validation.value as Extract<typeof validation.value, { mode: 'backtest' }>
    const { fo: _fo, ...normalizedBacktestConfig } = backtestValue
    const backtestConfig: BacktestConfig =
      body && typeof body === 'object' && !Array.isArray(body) && !('risk' in body)
        ? { ...normalizedBacktestConfig, risk: undefined }
        : normalizedBacktestConfig
    const result = await runBacktest(backtestConfig, defaultDb)
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
export async function handleGetBacktestRun(_req: Request, params: Record<string, string>): Promise<Response> {
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
  const builtins = listStrategies().map((s) => ({ ...s, kind: 'builtin' as const }))
  const custom = listCustom().map((row) => ({
    name: `custom:${row.id}`,
    description: row.description,
    defaultParams: Object.fromEntries(row.paramSpecs.map((s) => [s.key, s.defaultValue])),
    paramSpecs: row.paramSpecs,
    supportedIntervals: row.supportedIntervals,
    supportedModes: ['backtest'] as ('backtest' | 'paper' | 'live')[],
    kind: 'custom' as const,
    id: row.id,
    displayName: row.name,
  }))
  return Response.json({ data: [...builtins, ...custom] })
}

// Register dynamic (parameterized) routes
export function registerBacktestRoutes(): void {
  addDynamicRoute('GET', '/api/v1/backtest/history/:id', handleGetBacktestRun)
}
