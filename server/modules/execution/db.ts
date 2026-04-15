import type { Database } from 'bun:sqlite'
import defaultDb from '../../shared/db.ts'
import type { StrategyRunConfig } from '../../shared/contracts/index.ts'

export type StrategyRunStatus = 'running' | 'completed' | 'failed'

export interface StrategyRunRow {
  id: number
  strategy_name: string
  instrument_key: string
  mode: 'backtest' | 'paper' | 'live'
  config: string
  status: StrategyRunStatus
  started_at: string
  stopped_at: string | null
  error_message: string | null
}

export interface PersistedOrder {
  strategyRunId: number
  instrumentKey: string
  action: 'BUY' | 'SELL'
  quantity: number
  requestedPrice?: number
  filledPrice?: number
  slippage?: number
  fees?: number
  status: 'pending' | 'filled' | 'rejected'
  mode: 'backtest' | 'paper' | 'live'
  upstoxOrderId?: string
  rejectReason?: string
  createdAt?: string
  filledAt?: string
}

export interface OrderRow {
  id: number
  strategy_run_id: number
  instrument_key: string
  action: 'BUY' | 'SELL'
  quantity: number
  requested_price: number | null
  filled_price: number | null
  slippage: number
  fees: number
  status: string
  mode: 'backtest' | 'paper' | 'live'
  upstox_order_id: string | null
  reject_reason: string | null
  created_at: string
  filled_at: string | null
}

export function ensureExecutionTables(db: Database = defaultDb): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS strategy_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_name   TEXT NOT NULL,
      instrument_key  TEXT NOT NULL,
      mode            TEXT NOT NULL CHECK (mode IN ('backtest','paper','live')),
      config          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'running',
      started_at      TEXT DEFAULT (datetime('now')),
      stopped_at      TEXT,
      error_message   TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_run_id INTEGER REFERENCES strategy_runs(id),
      instrument_key  TEXT NOT NULL,
      action          TEXT NOT NULL CHECK (action IN ('BUY','SELL')),
      quantity        INTEGER NOT NULL,
      requested_price REAL,
      filled_price    REAL,
      slippage        REAL DEFAULT 0,
      fees            REAL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'pending',
      mode            TEXT NOT NULL,
      upstox_order_id TEXT,
      reject_reason   TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      filled_at       TEXT
    )
  `)
}

ensureExecutionTables(defaultDb)

export function createStrategyRun(
  config: Pick<StrategyRunConfig, 'mode' | 'strategyName' | 'instrumentKey'> & Record<string, unknown>,
  db: Database = defaultDb,
): number {
  ensureExecutionTables(db)

  const result = db.prepare(`
    INSERT INTO strategy_runs (strategy_name, instrument_key, mode, config, status)
    VALUES (?, ?, ?, ?, 'running')
  `).run(
    config.strategyName,
    config.instrumentKey,
    config.mode,
    JSON.stringify(config),
  )

  return Number(result.lastInsertRowid)
}

export function completeStrategyRun(
  strategyRunId: number,
  status: Extract<StrategyRunStatus, 'completed' | 'failed'>,
  errorMessage?: string,
  db: Database = defaultDb,
): void {
  ensureExecutionTables(db)

  db.prepare(`
    UPDATE strategy_runs
    SET status = ?, stopped_at = datetime('now'), error_message = ?
    WHERE id = ?
  `).run(status, errorMessage ?? null, strategyRunId)
}

export function getStrategyRun(strategyRunId: number, db: Database = defaultDb): StrategyRunRow | null {
  ensureExecutionTables(db)

  return db.query(`
    SELECT id, strategy_name, instrument_key, mode, config, status, started_at, stopped_at, error_message
    FROM strategy_runs
    WHERE id = ?
  `).get(strategyRunId) as StrategyRunRow | null
}

export function saveOrders(orders: PersistedOrder[], db: Database = defaultDb): void {
  if (orders.length === 0) {
    return
  }

  ensureExecutionTables(db)

  const stmt = db.prepare(`
    INSERT INTO orders (
      strategy_run_id,
      instrument_key,
      action,
      quantity,
      requested_price,
      filled_price,
      slippage,
      fees,
      status,
      mode,
      upstox_order_id,
      reject_reason,
      created_at,
      filled_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
  `)

  const transaction = db.transaction(() => {
    for (const order of orders) {
      stmt.run(
        order.strategyRunId,
        order.instrumentKey,
        order.action,
        order.quantity,
        order.requestedPrice ?? null,
        order.filledPrice ?? null,
        order.slippage ?? 0,
        order.fees ?? 0,
        order.status,
        order.mode,
        order.upstoxOrderId ?? null,
        order.rejectReason ?? null,
        order.createdAt ?? null,
        order.filledAt ?? null,
      )
    }
  })

  transaction()
}

export function listOrdersForRun(strategyRunId: number, db: Database = defaultDb): OrderRow[] {
  ensureExecutionTables(db)

  return db.query(`
    SELECT
      id,
      strategy_run_id,
      instrument_key,
      action,
      quantity,
      requested_price,
      filled_price,
      slippage,
      fees,
      status,
      mode,
      upstox_order_id,
      reject_reason,
      created_at,
      filled_at
    FROM orders
    WHERE strategy_run_id = ?
    ORDER BY id ASC
  `).all(strategyRunId) as OrderRow[]
}
