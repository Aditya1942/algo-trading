import { describe, expect, test } from 'bun:test'
import { BacktestExecutor } from '../backtest-executor.ts'
import type { Signal } from '../../strategy/types.ts'
import type { CandleRow } from '../../market-data/types.ts'

const candle: CandleRow = {
  instrument_key: 'NSE_EQ|TEST',
  timestamp: '2024-01-01T09:15:00+05:30',
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
  oi: 0,
}

const buySignal: Signal = {
  action: 'BUY',
  quantity: 50,
  price: 100,
  reason: 'Entry',
}

describe('BacktestExecutor', () => {
  test('fills at close when slippage is zero', () => {
    const executor = new BacktestExecutor()
    const fill = executor.execute(buySignal, {
      candle,
      balance: 10000,
      position: null,
      riskCheckResult: { allowed: true },
    })

    expect(fill.price).toBe(100)
    expect(fill.quantity).toBe(50)
    expect(fill.slippage).toBe(0)
    expect(fill.fees).toBe(0)
  })

  test('applies slippage and risk-adjusted quantity', () => {
    const executor = new BacktestExecutor({ slippagePct: 0.01 })
    const fill = executor.execute(buySignal, {
      candle,
      balance: 10000,
      position: null,
      riskCheckResult: { allowed: true, adjustedQuantity: 20 },
    })

    expect(fill.price).toBe(101)
    expect(fill.quantity).toBe(20)
    expect(fill.slippage).toBeCloseTo(1, 5)
  })
})
