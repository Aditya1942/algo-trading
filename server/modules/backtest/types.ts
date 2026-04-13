export interface BacktestConfig {
  strategyName: string
  instrumentKey: string
  from: string              // ISO date
  to: string                // ISO date
  interval: '1d' | '1h' | '1m'
  initialBalance: number
  params: Record<string, number>
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
