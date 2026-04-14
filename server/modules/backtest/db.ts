import defaultDb from '../../shared/db.ts'
import type { Database } from 'bun:sqlite'
import type { BacktestResult } from './types.ts'

// Schema — run on defaultDb at module load
defaultDb.run(`
  CREATE TABLE IF NOT EXISTS backtest_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_name   TEXT NOT NULL,
    instrument_key  TEXT NOT NULL,
    config          TEXT NOT NULL,
    result          TEXT NOT NULL,
    total_pnl       REAL,
    win_rate        REAL,
    total_trades    INTEGER,
    created_at      TEXT DEFAULT (datetime('now'))
  )
`)

export function saveBacktestRun(result: BacktestResult, db: Database = defaultDb): number {
  const { config, metrics } = result
  const stmt = db.prepare(`
    INSERT INTO backtest_runs
      (strategy_name, instrument_key, config, result, total_pnl, win_rate, total_trades)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const run = stmt.run(
    config.strategyName,
    config.instrumentKey,
    JSON.stringify(config),
    JSON.stringify(result),
    metrics.totalPnl,
    metrics.winRate,
    metrics.totalTrades,
  )
  return Number(run.lastInsertRowid)
}

export function listBacktestRuns(db: Database = defaultDb): Array<{
  id: number
  strategy_name: string
  instrument_key: string
  total_pnl: number
  win_rate: number
  total_trades: number
  created_at: string
}> {
  return db.query(`
    SELECT id, strategy_name, instrument_key, total_pnl, win_rate, total_trades, created_at
    FROM backtest_runs
    ORDER BY created_at DESC
  `).all() as Array<{
    id: number
    strategy_name: string
    instrument_key: string
    total_pnl: number
    win_rate: number
    total_trades: number
    created_at: string
  }>
}

export function getBacktestRun(id: number, db: Database = defaultDb): BacktestResult | null {
  const row = db.query('SELECT result FROM backtest_runs WHERE id = ?').get(id) as { result: string } | null
  if (!row) return null
  return JSON.parse(row.result) as BacktestResult
}
