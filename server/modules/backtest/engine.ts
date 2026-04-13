import type { Database } from 'bun:sqlite'
import type { BacktestConfig, BacktestResult, Trade } from './types.ts'
import { calculateMetrics } from './metrics.ts'
import { saveBacktestRun } from './db.ts'
import { queryCandlesAggregated } from '../market-data/db.ts'
import { getStrategy } from '../strategy/index.ts'

export async function runBacktest(config: BacktestConfig, db?: Database): Promise<BacktestResult> {
  const candles = queryCandlesAggregated(
    config.instrumentKey,
    config.from,
    config.to,
    config.interval,
    db,
  )

  const strategy = getStrategy(config.strategyName)
  strategy.onStart(config.params)

  let balance = config.initialBalance
  let position: { entryPrice: number; quantity: number; entryTimestamp: string } | null = null
  const trades: Trade[] = []
  const equityCurve: { timestamp: string; equity: number }[] = []

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!
    // Cap window at last 200 candles for indicator efficiency
    const windowStart = Math.max(0, i - 199)
    const window = candles.slice(windowStart, i + 1)

    const ctx = {
      position,
      candles: window,
      params: config.params,
    }

    const signal = strategy.onCandle(candle, ctx)

    if (signal) {
      if (signal.action === 'BUY' && !position) {
        const quantity = Math.floor(balance / candle.close)
        if (quantity > 0) {
          balance -= quantity * candle.close
          position = {
            entryPrice: candle.close,
            quantity,
            entryTimestamp: candle.timestamp,
          }
          trades.push({
            action: 'BUY',
            price: candle.close,
            quantity,
            timestamp: candle.timestamp,
            reason: signal.reason,
            balanceAfter: balance,
          })
        }
      } else if (signal.action === 'SELL' && position) {
        balance += position.quantity * candle.close
        trades.push({
          action: 'SELL',
          price: candle.close,
          quantity: position.quantity,
          timestamp: candle.timestamp,
          reason: signal.reason,
          balanceAfter: balance,
        })
        position = null
      }
    }

    const equity = balance + (position ? position.quantity * candle.close : 0)
    equityCurve.push({ timestamp: candle.timestamp, equity })
  }

  // Force-close any open position at last candle's close
  if (position && candles.length > 0) {
    const lastCandle = candles[candles.length - 1]!
    balance += position.quantity * lastCandle.close
    trades.push({
      action: 'SELL',
      price: lastCandle.close,
      quantity: position.quantity,
      timestamp: lastCandle.timestamp,
      reason: 'Force close at end of backtest',
      balanceAfter: balance,
    })
    // Update last equity curve entry to reflect force close
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1]!.equity = balance
    }
    position = null
  }

  strategy.onStop()

  const metrics = calculateMetrics(trades, config.initialBalance)

  const result: BacktestResult = {
    config,
    trades,
    metrics,
    equityCurve,
  }

  if (db !== undefined) {
    const id = saveBacktestRun(result, db)
    result.id = id
  }

  return result
}
