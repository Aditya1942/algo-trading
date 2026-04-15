export type RiskRejectCode =
  | 'DAILY_LOSS_EXCEEDED'
  | 'MAX_POSITIONS_EXCEEDED'
  | 'CAPITAL_PER_TRADE_EXCEEDED'
  | 'DRAWDOWN_EXCEEDED'
  | 'ORDER_RATE_EXCEEDED'
  | 'KILL_SWITCH_ACTIVE'

export interface RiskCheckResult {
  allowed: boolean
  rejectCode?: RiskRejectCode
  rejectReason?: string
  adjustedQuantity?: number
}

export interface RiskState {
  dailyPnl: number
  openPositionCount: number
  currentCapital: number
  initialCapital: number
  peakCapital: number
  ordersThisMinute: number
  killSwitchTripped: boolean
}

export interface RiskStateUpdate {
  dailyPnlDelta?: number
  openPositionCountDelta?: number
  currentCapital?: number
  ordersThisMinuteDelta?: number
  resetOrdersThisMinute?: boolean
  tripKillSwitch?: boolean
}
