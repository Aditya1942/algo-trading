import type { Trade, BacktestMetrics } from './types.ts'

export function calculateMetrics(trades: Trade[], initialBalance: number): BacktestMetrics {
  if (trades.length === 0) {
    return {
      totalPnl: 0,
      totalPnlPercent: 0,
      winRate: 0,
      totalTrades: 0,
      avgProfitPerTrade: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
    }
  }

  const finalBalance = trades[trades.length - 1]!.balanceAfter
  const totalPnl = finalBalance - initialBalance
  const totalPnlPercent = (totalPnl / initialBalance) * 100

  // Round trips: pair each BUY with the following SELL
  const roundTrips: Array<{ buyBalance: number; sellBalance: number }> = []
  let pendingBuyBalance: number | null = null

  for (const trade of trades) {
    if (trade.action === 'BUY') {
      // Track the balance before this BUY (i.e., what we had going into the buy)
      pendingBuyBalance = trade.balanceAfter
    } else if (trade.action === 'SELL' && pendingBuyBalance !== null) {
      roundTrips.push({ buyBalance: pendingBuyBalance, sellBalance: trade.balanceAfter })
      pendingBuyBalance = null
    }
  }

  const totalTrades = roundTrips.length
  const winningTrips = roundTrips.filter(rt => rt.sellBalance > rt.buyBalance).length
  const winRate = totalTrades > 0 ? winningTrips / totalTrades : 0
  const avgProfitPerTrade = totalTrades > 0 ? totalPnl / totalTrades : 0

  // Max drawdown: peak-to-trough decline in balanceAfter sequence
  const balances = trades.map(t => t.balanceAfter)
  let peak = initialBalance
  let maxDrawdown = 0
  let maxDrawdownPercent = 0

  for (const balance of balances) {
    if (balance > peak) {
      peak = balance
    }
    const drawdown = peak - balance
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0
    }
  }

  return {
    totalPnl,
    totalPnlPercent,
    winRate,
    totalTrades,
    avgProfitPerTrade,
    maxDrawdown,
    maxDrawdownPercent,
  }
}
