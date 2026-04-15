import type { RiskLimits } from '../../shared/contracts/index.ts'
import type { Signal } from '../strategy/types.ts'
import type { RiskCheckResult, RiskState } from './types.ts'

function reject(rejectCode: RiskCheckResult['rejectCode'], rejectReason: string): RiskCheckResult {
  return {
    allowed: false,
    rejectCode,
    rejectReason,
  }
}

export function checkPreTrade(
  signal: Signal,
  limits: RiskLimits,
  state: RiskState,
): RiskCheckResult {
  if (limits.killSwitchEnabled && state.killSwitchTripped) {
    return reject('KILL_SWITCH_ACTIVE', 'Kill switch is active')
  }

  const dailyLossPct = state.initialCapital === 0 ? 0 : (-state.dailyPnl / state.initialCapital) * 100
  if (dailyLossPct > limits.maxDailyLossPct) {
    return reject('DAILY_LOSS_EXCEEDED', 'Daily loss limit exceeded')
  }

  const drawdownPct =
    state.peakCapital === 0 ? 0 : ((state.peakCapital - state.currentCapital) / state.peakCapital) * 100
  if (drawdownPct > limits.maxStrategyDrawdownPct) {
    return reject('DRAWDOWN_EXCEEDED', 'Strategy drawdown limit exceeded')
  }

  if (state.ordersThisMinute >= limits.maxOrdersPerMinute) {
    return reject('ORDER_RATE_EXCEEDED', 'Order rate limit exceeded')
  }

  if (signal.action === 'BUY' && state.openPositionCount >= limits.maxOpenPositions) {
    return reject('MAX_POSITIONS_EXCEEDED', 'Maximum open positions reached')
  }

  if (signal.action !== 'BUY') {
    return { allowed: true }
  }

  const maxCapitalForTrade = (state.currentCapital * limits.maxCapitalPerTradePct) / 100
  const requestedCapital = signal.price * signal.quantity

  if (requestedCapital <= maxCapitalForTrade) {
    return { allowed: true }
  }

  const adjustedQuantity = Math.floor(maxCapitalForTrade / signal.price)
  if (adjustedQuantity < 1) {
    return reject('CAPITAL_PER_TRADE_EXCEEDED', 'Capital per trade limit would reduce quantity below 1')
  }

  return {
    allowed: true,
    adjustedQuantity,
  }
}
