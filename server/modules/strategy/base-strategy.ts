import type { CandleRow } from "../market-data/types.ts";
import type { Signal, StrategyContext } from "./types.ts";
import type { StrategyParamSpec } from "../../shared/contracts/index.ts";

export abstract class Strategy {
  abstract name: string;
  abstract description: string;
  abstract paramSpecs: StrategyParamSpec[];
  supportedIntervals?: ("1d" | "1h" | "1m")[];
  supportedModes?: ("backtest" | "paper" | "live")[];

  get defaultParams(): Record<string, number> {
    return Object.fromEntries(this.paramSpecs.map((spec) => [spec.key, spec.defaultValue]));
  }

  abstract onCandle(
    candle: CandleRow,
    ctx: StrategyContext,
  ): Signal | null | Promise<Signal | null>;
  abstract onStart(params: Record<string, number>): void | Promise<void>;
  abstract onStop(): void | Promise<void>;
}
