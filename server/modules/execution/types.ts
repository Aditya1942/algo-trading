import type { CandleRow } from '../market-data/types.ts'
import type { Position, Signal } from '../strategy/types.ts'
import type { RiskCheckResult } from '../risk/types.ts'

export interface Fill {
  price: number
  quantity: number
  timestamp: string
  slippage: number
  fees: number
  orderId?: string
}

export interface ExecutionContext {
  candle: CandleRow
  balance: number
  position: Position | null
  riskCheckResult: RiskCheckResult
}

export interface Executor {
  execute(signal: Signal, context: ExecutionContext): Fill | Promise<Fill>
}
