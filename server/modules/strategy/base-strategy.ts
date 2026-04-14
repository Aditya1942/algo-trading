import type { CandleRow } from "../market-data/types.ts";
import type { Signal, StrategyContext } from "./types.ts";

export abstract class Strategy {
  abstract name: string;
  abstract description: string;
  abstract defaultParams: Record<string, number>;

  abstract onCandle(candle: CandleRow, ctx: StrategyContext): Signal | null;
  abstract onStart(params: Record<string, number>): void;
  abstract onStop(): void;
}
