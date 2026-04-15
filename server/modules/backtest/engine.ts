import type { Database } from 'bun:sqlite'
import type { BacktestConfig, BacktestResult, Trade } from './types.ts'
import { calculateMetrics } from './metrics.ts'
import { saveBacktestRun } from './db.ts'
import { queryCandlesAggregated } from '../market-data/db.ts'
import { getStrategy, type Position, type Signal } from '../strategy/index.ts'
import {
  BacktestExecutor,
  completeStrategyRun,
  createStrategyRun,
  saveOrders,
  type PersistedOrder,
} from '../execution/index.ts'
import {
  applyRiskStateUpdate,
  checkPreTrade,
  checkRuntimeRisk,
  createInitialRiskState,
  type RiskCheckResult,
  type RiskState,
  saveRiskEvents,
} from '../risk/index.ts'

function getMinuteBucket(timestamp: string): string {
  return timestamp.slice(0, 16)
}

function getExecutableSignal(
  signal: Signal,
  candleClose: number,
  balance: number,
  position: Position | null,
): Signal | null {
  if (signal.action === 'BUY') {
    if (position) {
      return null
    }

    const quantity = Math.floor(balance / candleClose)
    if (quantity < 1) {
      return null
    }

    return {
      ...signal,
      price: candleClose,
      quantity,
    }
  }

  if (!position) {
    return null
  }

  return {
    ...signal,
    price: candleClose,
    quantity: position.quantity,
  }
}

function getAllowedRiskResult(): RiskCheckResult {
  return { allowed: true }
}

function addRejectedRiskEvent(
  riskEvents: Array<{
    rejectCode: NonNullable<RiskCheckResult['rejectCode']>
    rejectReason?: string
    signalAction: 'BUY' | 'SELL'
    signalQuantity: number
    riskState: RiskState
  }>,
  orders: PersistedOrder[],
  strategyRunId: number | undefined,
  config: BacktestConfig,
  signal: Signal,
  riskResult: RiskCheckResult,
  riskState: RiskState,
): void {
  if (!riskResult.rejectCode) {
    return
  }

  riskEvents.push({
    rejectCode: riskResult.rejectCode,
    rejectReason: riskResult.rejectReason,
    signalAction: signal.action,
    signalQuantity: signal.quantity,
    riskState,
  })

  if (strategyRunId !== undefined) {
    orders.push({
      strategyRunId,
      instrumentKey: config.instrumentKey,
      action: signal.action,
      quantity: signal.quantity,
      requestedPrice: signal.price,
      status: 'rejected',
      mode: config.mode,
      rejectReason: riskResult.rejectReason,
      createdAt: undefined,
    })
  }
}

export async function runBacktest(config: BacktestConfig, db?: Database): Promise<BacktestResult> {
  if (!config.from || !config.to) {
    throw new Error('Backtest config requires from and to dates')
  }

  const candles = queryCandlesAggregated(
    config.instrumentKey,
    config.from,
    config.to,
    config.interval,
    db,
  )

  const strategy = getStrategy(config.strategyName)
  const strategyRunId = db ? createStrategyRun(config, db) : undefined
  const persistedOrders: PersistedOrder[] = []
  const riskEvents: Array<{
    rejectCode: NonNullable<RiskCheckResult['rejectCode']>
    rejectReason?: string
    signalAction: 'BUY' | 'SELL'
    signalQuantity: number
    riskState: RiskState
  }> = []

  strategy.onStart(config.params)

  try {
    let balance = config.initialBalance
    let position: { entryPrice: number; quantity: number; entryTimestamp: string } | null = null
    const trades: Trade[] = []
    const equityCurve: { timestamp: string; equity: number }[] = []
    const executor = new BacktestExecutor({ slippagePct: config.slippagePct })
    const riskLimits = config.risk
    let riskState = createInitialRiskState(config.initialBalance)
    let lastMinuteBucket: string | null = null

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i]!
      // Cap window at last 200 candles for indicator efficiency
      const windowStart = Math.max(0, i - 199)
      const window = candles.slice(windowStart, i + 1)

      const ctx = {
        position,
        candles: window,
        params: config.params,
        mode: 'backtest' as const,
        balance,
        initialBalance: config.initialBalance,
        riskLimits,
      }

      const minuteBucket = getMinuteBucket(candle.timestamp)
      if (lastMinuteBucket !== minuteBucket) {
        riskState = applyRiskStateUpdate(riskState, { resetOrdersThisMinute: true })
        lastMinuteBucket = minuteBucket
      }

      const signal = strategy.onCandle(candle, ctx)

      if (signal) {
        const executableSignal = getExecutableSignal(signal, candle.close, balance, position)
        const runtimeRiskResult = riskLimits ? checkRuntimeRisk(riskLimits, riskState) : getAllowedRiskResult()

        if (executableSignal && !runtimeRiskResult.allowed) {
          addRejectedRiskEvent(
            riskEvents,
            persistedOrders,
            strategyRunId,
            config,
            executableSignal,
            runtimeRiskResult,
            riskState,
          )
        }

        if (executableSignal && runtimeRiskResult.allowed) {
          const riskCheckResult = riskLimits
            ? checkPreTrade(executableSignal, riskLimits, riskState)
            : getAllowedRiskResult()

          if (!riskCheckResult.allowed) {
            addRejectedRiskEvent(
              riskEvents,
              persistedOrders,
              strategyRunId,
              config,
              executableSignal,
              riskCheckResult,
              riskState,
            )
          }

          if (riskCheckResult.allowed) {
            const fill = await executor.execute(executableSignal, {
              candle,
              balance,
              position,
              riskCheckResult,
            })

            if (executableSignal.action === 'BUY') {
              const tradeCost = fill.quantity * fill.price + fill.fees
              balance -= tradeCost
              position = {
                entryPrice: fill.price,
                quantity: fill.quantity,
                entryTimestamp: fill.timestamp,
              }
              trades.push({
                action: 'BUY',
                price: fill.price,
                quantity: fill.quantity,
                timestamp: fill.timestamp,
                reason: executableSignal.reason,
                balanceAfter: balance,
              })
              if (strategyRunId !== undefined) {
                persistedOrders.push({
                  strategyRunId,
                  instrumentKey: config.instrumentKey,
                  action: 'BUY',
                  quantity: fill.quantity,
                  requestedPrice: executableSignal.price,
                  filledPrice: fill.price,
                  slippage: fill.slippage,
                  fees: fill.fees,
                  status: 'filled',
                  mode: config.mode,
                  upstoxOrderId: fill.orderId,
                  createdAt: fill.timestamp,
                  filledAt: fill.timestamp,
                })
              }
              riskState = applyRiskStateUpdate(riskState, {
                openPositionCountDelta: 1,
                ordersThisMinuteDelta: 1,
                currentCapital: balance + fill.quantity * candle.close,
              })
            } else if (position) {
              const previousPosition = position
              const tradeProceeds = fill.quantity * fill.price - fill.fees
              balance += tradeProceeds
              trades.push({
                action: 'SELL',
                price: fill.price,
                quantity: fill.quantity,
                timestamp: fill.timestamp,
                reason: executableSignal.reason,
                balanceAfter: balance,
              })
              if (strategyRunId !== undefined) {
                persistedOrders.push({
                  strategyRunId,
                  instrumentKey: config.instrumentKey,
                  action: 'SELL',
                  quantity: fill.quantity,
                  requestedPrice: executableSignal.price,
                  filledPrice: fill.price,
                  slippage: fill.slippage,
                  fees: fill.fees,
                  status: 'filled',
                  mode: config.mode,
                  upstoxOrderId: fill.orderId,
                  createdAt: fill.timestamp,
                  filledAt: fill.timestamp,
                })
              }
              position = null
              riskState = applyRiskStateUpdate(riskState, {
                dailyPnlDelta:
                  (fill.price - previousPosition.entryPrice) * fill.quantity - fill.fees,
                openPositionCountDelta: -1,
                ordersThisMinuteDelta: 1,
                currentCapital: balance,
              })
            }
          }
        }
      }

      const equity = balance + (position ? position.quantity * candle.close : 0)
      riskState = applyRiskStateUpdate(riskState, { currentCapital: equity })
      equityCurve.push({ timestamp: candle.timestamp, equity })
    }

    // Force-close any open position at last candle's close
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1]!
      const fill = await executor.execute(
        {
          action: 'SELL',
          quantity: position.quantity,
          price: lastCandle.close,
          reason: 'Force close at end of backtest',
        },
        {
          candle: lastCandle,
          balance,
          position,
          riskCheckResult: getAllowedRiskResult(),
        },
      )
      balance += fill.quantity * fill.price - fill.fees
      trades.push({
        action: 'SELL',
        price: fill.price,
        quantity: fill.quantity,
        timestamp: fill.timestamp,
        reason: 'Force close at end of backtest',
        balanceAfter: balance,
      })
      if (strategyRunId !== undefined) {
        persistedOrders.push({
          strategyRunId,
          instrumentKey: config.instrumentKey,
          action: 'SELL',
          quantity: fill.quantity,
          requestedPrice: lastCandle.close,
          filledPrice: fill.price,
          slippage: fill.slippage,
          fees: fill.fees,
          status: 'filled',
          mode: config.mode,
          upstoxOrderId: fill.orderId,
          createdAt: fill.timestamp,
          filledAt: fill.timestamp,
        })
      }
      riskState = applyRiskStateUpdate(riskState, {
        dailyPnlDelta: (fill.price - position.entryPrice) * fill.quantity - fill.fees,
        openPositionCountDelta: -1,
        ordersThisMinuteDelta: 1,
        currentCapital: balance,
      })
      // Update last equity curve entry to reflect force close
      if (equityCurve.length > 0) {
        equityCurve[equityCurve.length - 1]!.equity = balance
      }
      position = null
    }

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
      if (strategyRunId !== undefined) {
        saveOrders(persistedOrders, db)
        saveRiskEvents(
          riskEvents.map((event) => ({
            strategyRunId,
            rejectCode: event.rejectCode,
            rejectReason: event.rejectReason,
            signalAction: event.signalAction,
            signalQuantity: event.signalQuantity,
            riskState: event.riskState,
          })),
          db,
        )
        completeStrategyRun(strategyRunId, 'completed', undefined, db)
      }
    }

    return result
  } catch (error) {
    if (db !== undefined && strategyRunId !== undefined) {
      completeStrategyRun(
        strategyRunId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
        db,
      )
    }
    throw error
  } finally {
    strategy.onStop()
  }
}
