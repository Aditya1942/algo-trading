import type { Signal } from '../strategy/types.ts'
import type { ExecutionContext, Executor, Fill } from './types.ts'

export interface BacktestExecutorOptions {
  slippagePct?: number
}

export class BacktestExecutor implements Executor {
  constructor(private readonly options: BacktestExecutorOptions = {}) {}

  execute(signal: Signal, context: ExecutionContext): Fill {
    const quantity = context.riskCheckResult.adjustedQuantity ?? signal.quantity
    const basePrice = context.candle.close
    const slippagePct = this.options.slippagePct ?? 0
    const rawPrice =
      signal.action === 'BUY'
        ? basePrice * (1 + slippagePct)
        : basePrice * (1 - slippagePct)
    const price = Number(rawPrice.toFixed(6))

    return {
      price,
      quantity,
      timestamp: context.candle.timestamp,
      slippage: Math.abs(price - basePrice),
      fees: 0,
    }
  }
}
