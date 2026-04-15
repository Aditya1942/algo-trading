import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { DEFAULT_RISK_LIMITS } from '../../../shared/contracts/index.ts'
import { insertCandles } from '../../market-data/db.ts'
import type { CandleRow } from '../../market-data/types.ts'
import { runBacktest } from '../../backtest/engine.ts'
import type { BacktestConfig } from '../../backtest/types.ts'
import { getStrategyRun, listOrdersForRun } from '../db.ts'
import { listRiskEventsForRun } from '../../risk/db.ts'

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA journal_mode=WAL')
  db.run(`
    CREATE TABLE IF NOT EXISTS tracked_instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      exchange TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      earliest_fetched TEXT, latest_fetched TEXT, error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS candles (
      instrument_key TEXT NOT NULL, timestamp TEXT NOT NULL,
      open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL,
      close REAL NOT NULL, volume INTEGER NOT NULL, oi INTEGER NOT NULL DEFAULT 0,
      UNIQUE(instrument_key, timestamp)
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_candles_key_ts ON candles(instrument_key, timestamp)')
  db.run(`
    CREATE TABLE IF NOT EXISTS backtest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_name TEXT NOT NULL,
      instrument_key TEXT NOT NULL,
      config TEXT NOT NULL,
      result TEXT NOT NULL,
      total_pnl REAL,
      win_rate REAL,
      total_trades INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  return db
}

function makeCandle(key: string, ts: string, close: number): CandleRow {
  return { instrument_key: key, timestamp: ts, open: close, high: close + 5, low: close - 3, close, volume: 1000, oi: 0 }
}

const KEY = 'NSE_EQ|TEST'

function makeCandles(prices: number[], month: string): CandleRow[] {
  return prices.map((price, index) => {
    const day = String(index + 1).padStart(2, '0')
    return makeCandle(KEY, `2024-${month}-${day}T09:15:00+05:30`, price)
  })
}

const baseConfig: BacktestConfig = {
  mode: 'backtest',
  strategyName: 'sma-crossover',
  instrumentKey: KEY,
  from: '2024-01-01',
  to: '2024-12-31',
  interval: '1m',
  initialBalance: 10000,
  params: { fastPeriod: 3, slowPeriod: 5 },
  risk: DEFAULT_RISK_LIMITS,
}

let db: Database

beforeEach(() => {
  db = createTestDb()
})

describe('runBacktest persistence integration', () => {
  test('persists strategy run metadata and filled orders for successful executions', async () => {
    insertCandles(makeCandles([100, 100, 100, 100, 100, 200], '01'), db)

    const result = await runBacktest({
      ...baseConfig,
      from: '2024-01-01',
      to: '2024-01-31',
      slippagePct: 0.05,
    }, db)

    expect(result.id).toBeDefined()

    const strategyRun = getStrategyRun(1, db)
    expect(strategyRun).not.toBeNull()
    expect(strategyRun!.status).toBe('completed')

    const orders = listOrdersForRun(strategyRun!.id, db)
    expect(orders).toHaveLength(2)
    expect(orders.every((order) => order.status === 'filled')).toBe(true)
    expect(orders[0]!.filled_price).toBeGreaterThan(orders[0]!.requested_price!)

    const riskEvents = listRiskEventsForRun(strategyRun!.id, db)
    expect(riskEvents).toEqual([])
  })

  test('persists rejected risk events and rejected orders when a trade is blocked', async () => {
    insertCandles(makeCandles([100, 100, 100, 100, 100, 200], '04'), db)

    await runBacktest({
      ...baseConfig,
      from: '2024-04-01',
      to: '2024-04-30',
      risk: { ...DEFAULT_RISK_LIMITS, maxCapitalPerTradePct: 1 },
    }, db)

    const strategyRun = getStrategyRun(1, db)
    expect(strategyRun).not.toBeNull()
    expect(strategyRun!.status).toBe('completed')

    const orders = listOrdersForRun(strategyRun!.id, db)
    expect(orders).toHaveLength(1)
    expect(orders[0]!.status).toBe('rejected')
    expect(orders[0]!.reject_reason).toContain('Capital per trade')

    const riskEvents = listRiskEventsForRun(strategyRun!.id, db)
    expect(riskEvents).toHaveLength(1)
    expect(riskEvents[0]!.reject_code).toBe('CAPITAL_PER_TRADE_EXCEEDED')
    expect(riskEvents[0]!.signal_action).toBe('BUY')
  })
})
