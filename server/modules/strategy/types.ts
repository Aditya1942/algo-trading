import type { CandleRow } from "../market-data/types.ts";
import type { RiskLimits } from "../../shared/contracts/index.ts";

export type { CandleRow };

export interface Signal {
  action: "BUY" | "SELL";
  quantity: number;
  price: number; // signal price (candle close)
  reason: string; // human-readable e.g. "SMA10 crossed above SMA50"
}

export interface Position {
  entryPrice: number;
  quantity: number;
  entryTimestamp: string;
}

export interface StrategyContext {
  position: Position | null; // current open position (if any)
  candles: CandleRow[]; // historical window for indicator calc
  params: Record<string, number>; // tunable params
  mode?: "backtest" | "paper" | "live";
  balance?: number;
  initialBalance?: number;
  riskLimits?: RiskLimits;
}
