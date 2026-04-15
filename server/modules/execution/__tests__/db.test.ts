import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import {
  completeStrategyRun,
  createStrategyRun,
  getStrategyRun,
  listOrdersForRun,
  saveOrders,
} from '../db.ts'

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA journal_mode=WAL')
  return db
}

let db: Database

beforeEach(() => {
  db = createTestDb()
})

describe('execution db', () => {
  test('creates and completes a strategy run with serialized config', () => {
    const strategyRunId = createStrategyRun({
      mode: 'backtest',
      strategyName: 'sma-crossover',
      instrumentKey: 'NSE_EQ|TEST',
      interval: '1d',
      from: '2024-01-01',
      to: '2024-01-31',
      initialBalance: 100000,
      params: { fastPeriod: 10, slowPeriod: 50 },
      risk: {
        maxDailyLossPct: 3,
        maxOpenPositions: 5,
        maxCapitalPerTradePct: 20,
        maxStrategyDrawdownPct: 15,
        maxOrdersPerMinute: 10,
        killSwitchEnabled: true,
      },
    }, db)

    const runningRow = getStrategyRun(strategyRunId, db)
    expect(runningRow).not.toBeNull()
    expect(runningRow!.status).toBe('running')
    expect(JSON.parse(runningRow!.config)).toMatchObject({
      strategyName: 'sma-crossover',
      instrumentKey: 'NSE_EQ|TEST',
    })

    completeStrategyRun(strategyRunId, 'completed', undefined, db)

    const completedRow = getStrategyRun(strategyRunId, db)
    expect(completedRow).not.toBeNull()
    expect(completedRow!.status).toBe('completed')
    expect(typeof completedRow!.stopped_at).toBe('string')
  })

  test('persists filled and rejected orders for a strategy run', () => {
    const strategyRunId = createStrategyRun({
      mode: 'backtest',
      strategyName: 'sma-crossover',
      instrumentKey: 'NSE_EQ|TEST',
      interval: '1d',
      from: '2024-01-01',
      to: '2024-01-31',
      initialBalance: 100000,
      params: { fastPeriod: 10, slowPeriod: 50 },
      risk: {
        maxDailyLossPct: 3,
        maxOpenPositions: 5,
        maxCapitalPerTradePct: 20,
        maxStrategyDrawdownPct: 15,
        maxOrdersPerMinute: 10,
        killSwitchEnabled: true,
      },
    }, db)

    saveOrders([
      {
        strategyRunId,
        instrumentKey: 'NSE_EQ|TEST',
        action: 'BUY',
        quantity: 50,
        requestedPrice: 200,
        filledPrice: 202,
        slippage: 2,
        fees: 0,
        status: 'filled',
        mode: 'backtest',
        filledAt: '2024-01-10T09:15:00+05:30',
      },
      {
        strategyRunId,
        instrumentKey: 'NSE_EQ|TEST',
        action: 'SELL',
        quantity: 50,
        requestedPrice: 190,
        status: 'rejected',
        mode: 'backtest',
        rejectReason: 'Daily loss limit exceeded',
      },
    ], db)

    const orders = listOrdersForRun(strategyRunId, db)
    expect(orders).toHaveLength(2)
    expect(orders[0]!.status).toBe('filled')
    expect(orders[0]!.filled_price).toBe(202)
    expect(orders[1]!.status).toBe('rejected')
    expect(orders[1]!.reject_reason).toBe('Daily loss limit exceeded')
  })
})
