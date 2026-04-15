import type { Signal } from '../strategy/types.ts'
import type { ExecutionContext, Executor, Fill } from './types.ts'

export interface PaperExecutorOptions {
  slippagePct?: number
}

export class PaperExecutor implements Executor {
  constructor(private readonly options: PaperExecutorOptions = {}) {}

  async execute(signal: Signal, context: ExecutionContext): Promise<Fill> {
    const quantity = context.riskCheckResult.adjustedQuantity ?? signal.quantity
    const basePrice = context.candle.close
    const slippagePct = this.options.slippagePct ?? 0.001
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
      orderId: `paper-${context.candle.timestamp}`,
    }
  }
}
