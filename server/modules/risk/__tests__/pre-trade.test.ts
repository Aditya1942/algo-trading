import { describe, expect, test } from 'bun:test'
import { DEFAULT_RISK_LIMITS } from '../../../shared/contracts/index.ts'
import { checkPreTrade } from '../pre-trade.ts'
import type { RiskState } from '../types.ts'
import type { Signal } from '../../strategy/types.ts'

const baseState: RiskState = {
  dailyPnl: 0,
  openPositionCount: 0,
  currentCapital: 100000,
  initialCapital: 100000,
  peakCapital: 100000,
  ordersThisMinute: 0,
  killSwitchTripped: false,
}

const buySignal: Signal = {
  action: 'BUY',
  quantity: 10,
  price: 1000,
  reason: 'Entry signal',
}

describe('checkPreTrade', () => {
  test('allows a trade when all limits are healthy', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, baseState)

    expect(result.allowed).toBe(true)
    expect(result.adjustedQuantity).toBeUndefined()
  })

  test('rejects when kill switch is active', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, {
      ...baseState,
      killSwitchTripped: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('KILL_SWITCH_ACTIVE')
  })

  test('rejects when daily loss limit is exceeded', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, {
      ...baseState,
      dailyPnl: -5000,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('DAILY_LOSS_EXCEEDED')
  })

  test('rejects when max open positions would be exceeded', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, {
      ...baseState,
      openPositionCount: DEFAULT_RISK_LIMITS.maxOpenPositions,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('MAX_POSITIONS_EXCEEDED')
  })

  test('caps quantity when capital-per-trade limit is breached but still affordable', () => {
    const result = checkPreTrade(
      { ...buySignal, quantity: 30, price: 1000 },
      DEFAULT_RISK_LIMITS,
      baseState,
    )

    expect(result.allowed).toBe(true)
    expect(result.adjustedQuantity).toBe(20)
  })

  test('rejects when capital-per-trade limit allows zero quantity', () => {
    const result = checkPreTrade(
      { ...buySignal, quantity: 1, price: 50000 },
      { ...DEFAULT_RISK_LIMITS, maxCapitalPerTradePct: 10 },
      baseState,
    )

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('CAPITAL_PER_TRADE_EXCEEDED')
  })

  test('rejects when drawdown limit is exceeded', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, {
      ...baseState,
      currentCapital: 80000,
      peakCapital: 100000,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('DRAWDOWN_EXCEEDED')
  })

  test('rejects when order rate limit is exceeded', () => {
    const result = checkPreTrade(buySignal, DEFAULT_RISK_LIMITS, {
      ...baseState,
      ordersThisMinute: DEFAULT_RISK_LIMITS.maxOrdersPerMinute,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('ORDER_RATE_EXCEEDED')
  })
})
