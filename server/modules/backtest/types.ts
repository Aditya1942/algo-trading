import type { RiskLimits, StrategyRunConfig } from '../../shared/contracts/index.ts'

export type BacktestConfig = Omit<StrategyRunConfig, 'fo' | 'risk'> & {
  mode: 'backtest'
  risk?: RiskLimits
  slippagePct?: number
}

export interface Trade {
  action: 'BUY' | 'SELL'
  price: number
  quantity: number
  timestamp: string
  reason: string
  balanceAfter: number
}

export interface BacktestResult {
  id?: number
  config: BacktestConfig
  trades: Trade[]
  metrics: BacktestMetrics
  equityCurve: { timestamp: string; equity: number }[]
  createdAt?: string
}

export interface BacktestMetrics {
  totalPnl: number
  totalPnlPercent: number
  winRate: number
  totalTrades: number
  avgProfitPerTrade: number
  maxDrawdown: number
  maxDrawdownPercent: number
}
