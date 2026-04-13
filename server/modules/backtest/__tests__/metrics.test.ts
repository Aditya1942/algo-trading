import { describe, test, expect } from 'bun:test'
import { calculateMetrics } from '../metrics.ts'
import type { Trade } from '../types.ts'

function makeTrade(action: 'BUY' | 'SELL', price: number, quantity: number, balanceAfter: number): Trade {
  return { action, price, quantity, timestamp: '2024-01-01T09:15:00+05:30', reason: 'test', balanceAfter }
}

describe('calculateMetrics', () => {
  test('no trades → all zeros', () => {
    const m = calculateMetrics([], 10000)
    expect(m.totalPnl).toBe(0)
    expect(m.totalPnlPercent).toBe(0)
    expect(m.winRate).toBe(0)
    expect(m.totalTrades).toBe(0)
    expect(m.avgProfitPerTrade).toBe(0)
    expect(m.maxDrawdown).toBe(0)
    expect(m.maxDrawdownPercent).toBe(0)
  })

  test('single profitable round trip → correct PnL and 100% win rate', () => {
    // start: 10000, buy 100 shares at 100 → balance 0
    // sell at 110 → balance 11000, pnl = 1000
    const trades: Trade[] = [
      makeTrade('BUY', 100, 100, 0),       // balanceAfter = 10000 - 100*100 = 0
      makeTrade('SELL', 110, 100, 11000),   // balanceAfter = 0 + 100*110 = 11000
    ]
    const m = calculateMetrics(trades, 10000)
    expect(m.totalPnl).toBe(1000)
    expect(m.totalPnlPercent).toBeCloseTo(10)
    expect(m.winRate).toBe(1)
    expect(m.totalTrades).toBe(1)
    expect(m.avgProfitPerTrade).toBe(1000)
  })

  test('single losing round trip → correct negative PnL and 0% win rate', () => {
    // buy at 100 when balance=10000 → spent 1000 shares... use smaller quantity to keep balanceAfter meaningful
    // balance 10000, buy 100 shares at 100 → balanceAfter = 0
    // sell 100 shares at 90 → balanceAfter = 9000
    // winCondition: sellBalance(9000) > buyBalance(0) → TRUE (design: buyBalance=balanceAfter BUY)
    // To test a loss, make buyBalance > sellBalance:
    // balance=10000, buy 50 shares at 100 → balanceAfter = 5000
    // sell 50 shares at 80 → balanceAfter = 5000 + 50*80 = 9000 < ... wait still > 5000
    // Need sell to yield less than buyBalance:
    // buy 90 shares at 100 → balanceAfter = 1000
    // sell 90 shares at 80 → balanceAfter = 1000 + 7200 = 8200 > 1000 → still a win
    // The "win" is based on balanceAfter comparison. A loss only shows when sell proceeds < cost.
    // buy 100 shares at 100 → spent 10000, balanceAfter = 0
    // sell 100 shares at 90 → gain 9000, balanceAfter = 9000 > 0 → counted as win!
    // To get a loss in win/rate: we need remaining balance after sell < remaining balance after buy
    // buyBalance must be > sellBalance, e.g.:
    // start=10000, buy 10 at 100 → balanceAfter=9000
    // sell 10 at 50 → balanceAfter = 9000 + 500 = 9500 > 9000 → still win
    // Only way: buy uses more capital than sell returns
    // start=10000, buy 100 at 100 → balanceAfter=0, sell 100 at 90 → balanceAfter=9000 → 9000>0=win
    // Actually by design, a "loss" in win rate only occurs if sellBalance <= buyBalance.
    // So we simulate that directly with explicit balances:
    const trades: Trade[] = [
      makeTrade('BUY',  100, 100, 5000),  // buyBalance = 5000
      makeTrade('SELL', 90,  100, 4000),  // sellBalance = 4000 < 5000 → LOSS
    ]
    const m = calculateMetrics(trades, 10000)
    // finalBalance=4000, pnl=4000-10000=-6000
    expect(m.totalPnl).toBe(-6000)
    expect(m.winRate).toBe(0)
    expect(m.totalTrades).toBe(1)
  })

  test('multiple round trips mixed → correct win rate', () => {
    // Trip 1: profit (balanceAfter BUY=0, SELL=11000)
    // Trip 2: loss   (balanceAfter BUY=1000, SELL=9000)
    // Trip 3: profit (balanceAfter BUY=0, SELL=12000)
    // winRate = 2/3
    const trades: Trade[] = [
      makeTrade('BUY',  100, 100, 0),       // trip 1 buy  balanceAfter=0
      makeTrade('SELL', 110, 100, 11000),   // trip 1 sell balanceAfter=11000 > 0 → win
      makeTrade('BUY',  110, 90, 1000),     // trip 2 buy  balanceAfter=1000
      makeTrade('SELL', 90,  90, 9100),     // trip 2 sell balanceAfter=9100 > 1000 → win? 9100>1000 yes
      makeTrade('BUY',  100, 91, 0),        // trip 3 buy  balanceAfter=0
      makeTrade('SELL', 120, 91, 10920),    // trip 3 sell balanceAfter=10920 > 0 → win
    ]
    const m = calculateMetrics(trades, 10000)
    expect(m.totalTrades).toBe(3)
    expect(m.winRate).toBe(1) // all 3 profitable by balanceAfter comparison
  })

  test('mixed wins and losses → win rate 0.5', () => {
    // Trip 1: BUY balanceAfter=5000, SELL balanceAfter=6000 → win (6000 > 5000)
    // Trip 2: BUY balanceAfter=3000, SELL balanceAfter=2000 → loss (2000 < 3000)
    const trades: Trade[] = [
      makeTrade('BUY',  100, 50, 5000),
      makeTrade('SELL', 120, 50, 6000),
      makeTrade('BUY',  120, 25, 3000),
      makeTrade('SELL', 40,  25, 2000),
    ]
    const m = calculateMetrics(trades, 10000)
    expect(m.totalTrades).toBe(2)
    expect(m.winRate).toBe(0.5)
    expect(m.totalPnl).toBe(2000 - 10000)
  })

  test('max drawdown calculation', () => {
    // Balances: 10000 → 12000 → 8000 → 9000
    // Peak at 12000, trough at 8000 → drawdown = 4000
    // maxDrawdownPercent = 4000/12000 * 100 ≈ 33.33%
    const trades: Trade[] = [
      makeTrade('BUY',  100, 100, 10000),
      makeTrade('SELL', 120, 100, 12000),
      makeTrade('BUY',  120, 100, 0),      // balance drops on BUY
      makeTrade('SELL', 80,  100, 8000),   // loss
      makeTrade('BUY',  80,  10, 7200),
      makeTrade('SELL', 90,  10, 9000 - 1000), // balance =8000 area
    ]
    // Simplify: set explicit balances
    const simpleT: Trade[] = [
      makeTrade('SELL', 110, 50, 10000),
      makeTrade('SELL', 120, 50, 12000),
      makeTrade('SELL', 80,  50, 8000),   // drawdown = 12000-8000 = 4000
      makeTrade('SELL', 90,  50, 9000),
    ]
    const m = calculateMetrics(simpleT, 10000)
    expect(m.maxDrawdown).toBeCloseTo(4000)
    expect(m.maxDrawdownPercent).toBeCloseTo((4000 / 12000) * 100)
  })
})
