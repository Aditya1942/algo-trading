import { describe, test, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import type { BacktestResult } from '../types.ts'
import { saveBacktestRun, listBacktestRuns, getBacktestRun } from '../db.ts'

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA journal_mode=WAL')
  db.run(`
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
  return db
}

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    config: {
      mode: 'backtest',
      strategyName: 'sma-crossover',
      instrumentKey: 'NSE_EQ|TEST',
      from: '2024-01-01',
      to: '2024-12-31',
      interval: '1d',
      initialBalance: 10000,
      params: { fastPeriod: 10, slowPeriod: 50 },
    },
    trades: [],
    metrics: {
      totalPnl: 500,
      totalPnlPercent: 5,
      winRate: 0.6,
      totalTrades: 5,
      avgProfitPerTrade: 100,
      maxDrawdown: 200,
      maxDrawdownPercent: 2,
    },
    equityCurve: [{ timestamp: '2024-01-01', equity: 10500 }],
    ...overrides,
  }
}

let db: Database

beforeEach(() => {
  db = createTestDb()
})

describe('saveBacktestRun', () => {
  test('returns a numeric id', () => {
    const result = makeResult()
    const id = saveBacktestRun(result, db)
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  test('increments id on subsequent saves', () => {
    const id1 = saveBacktestRun(makeResult(), db)
    const id2 = saveBacktestRun(makeResult(), db)
    expect(id2).toBeGreaterThan(id1)
  })
})

describe('listBacktestRuns', () => {
  test('returns summary list with correct count and fields', () => {
    saveBacktestRun(makeResult(), db)
    saveBacktestRun(makeResult({ config: { ...makeResult().config, strategyName: 'rsi-macd' } }), db)
    const list = listBacktestRuns(db)
    expect(list.length).toBe(2)
    const names = list.map(r => r.strategy_name)
    expect(names).toContain('sma-crossover')
    expect(names).toContain('rsi-macd')
  })

  test('returned rows have expected fields', () => {
    const r = makeResult()
    saveBacktestRun(r, db)
    const list = listBacktestRuns(db)
    const row = list[0]!
    expect(row.id).toBeGreaterThan(0)
    expect(row.strategy_name).toBe('sma-crossover')
    expect(row.instrument_key).toBe('NSE_EQ|TEST')
    expect(row.total_pnl).toBe(500)
    expect(row.win_rate).toBe(0.6)
    expect(row.total_trades).toBe(5)
    expect(typeof row.created_at).toBe('string')
  })

  test('empty db returns empty array', () => {
    const list = listBacktestRuns(db)
    expect(list).toEqual([])
  })
})

describe('getBacktestRun', () => {
  test('returns full parsed BacktestResult', () => {
    const r = makeResult()
    const id = saveBacktestRun(r, db)
    const loaded = getBacktestRun(id, db)
    expect(loaded).not.toBeNull()
    expect(loaded!.config.strategyName).toBe('sma-crossover')
    expect(loaded!.metrics.totalPnl).toBe(500)
    expect(loaded!.equityCurve.length).toBe(1)
    expect(loaded!.equityCurve[0]!.equity).toBe(10500)
  })

  test('returns null for missing id', () => {
    const loaded = getBacktestRun(9999, db)
    expect(loaded).toBeNull()
  })

  test('result JSON parses correctly with trades', () => {
    const r = makeResult({
      trades: [
        { action: 'BUY', price: 100, quantity: 10, timestamp: '2024-01-02', reason: 'golden cross', balanceAfter: 9000 },
        { action: 'SELL', price: 110, quantity: 10, timestamp: '2024-01-05', reason: 'death cross', balanceAfter: 10100 },
      ],
    })
    const id = saveBacktestRun(r, db)
    const loaded = getBacktestRun(id, db)!
    expect(loaded.trades.length).toBe(2)
    expect(loaded.trades[0]!.action).toBe('BUY')
    expect(loaded.trades[1]!.action).toBe('SELL')
  })
})
