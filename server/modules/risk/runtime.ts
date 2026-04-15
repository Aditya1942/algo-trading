import type { RiskLimits } from '../../shared/contracts/index.ts'
import type { RiskCheckResult, RiskState, RiskStateUpdate } from './types.ts'

function reject(rejectCode: RiskCheckResult['rejectCode'], rejectReason: string): RiskCheckResult {
  return {
    allowed: false,
    rejectCode,
    rejectReason,
  }
}

export function createInitialRiskState(initialCapital: number): RiskState {
  return {
    dailyPnl: 0,
    openPositionCount: 0,
    currentCapital: initialCapital,
    initialCapital,
    peakCapital: initialCapital,
    ordersThisMinute: 0,
    killSwitchTripped: false,
  }
}

export function applyRiskStateUpdate(state: RiskState, update: RiskStateUpdate): RiskState {
  const nextCurrentCapital = update.currentCapital ?? state.currentCapital

  return {
    dailyPnl: state.dailyPnl + (update.dailyPnlDelta ?? 0),
    openPositionCount: Math.max(0, state.openPositionCount + (update.openPositionCountDelta ?? 0)),
    currentCapital: nextCurrentCapital,
    initialCapital: state.initialCapital,
    peakCapital: Math.max(state.peakCapital, nextCurrentCapital),
    ordersThisMinute: update.resetOrdersThisMinute
      ? 0
      : Math.max(0, state.ordersThisMinute + (update.ordersThisMinuteDelta ?? 0)),
    killSwitchTripped: state.killSwitchTripped || Boolean(update.tripKillSwitch),
  }
}

export function checkRuntimeRisk(limits: RiskLimits, state: RiskState): RiskCheckResult {
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

  return { allowed: true }
}
