import { describe, expect, test } from 'bun:test'
import { PaperExecutor } from '../paper-executor.ts'
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

const sellSignal: Signal = {
  action: 'SELL',
  quantity: 25,
  price: 100,
  reason: 'Exit',
}

describe('PaperExecutor', () => {
  test('applies default paper slippage and returns a synthetic order id', async () => {
    const executor = new PaperExecutor()
    const fill = await executor.execute(sellSignal, {
      candle,
      balance: 10000,
      position: { entryPrice: 95, quantity: 25, entryTimestamp: '2024-01-01T09:00:00+05:30' },
      riskCheckResult: { allowed: true },
    })

    expect(fill.price).toBe(99.9)
    expect(fill.quantity).toBe(25)
    expect(fill.orderId).toContain('paper-')
    expect(fill.slippage).toBeCloseTo(0.1, 5)
  })
})
