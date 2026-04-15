import { sma } from "../../indicators/index.ts";
import { Strategy } from "../base-strategy.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { Signal, StrategyContext } from "../types.ts";
import type { StrategyParamSpec } from "../../../shared/contracts/index.ts";

export class SmaCrossoverStrategy extends Strategy {
  name = "sma-crossover";
  description = "Trades SMA fast/slow crossovers. BUY on golden cross, SELL on death cross.";
  paramSpecs: StrategyParamSpec[] = [
    {
      key: "fastPeriod",
      label: "Fast Period",
      type: "integer",
      required: true,
      defaultValue: 10,
      min: 2,
      max: 200,
      step: 1,
      group: "SMA",
    },
    {
      key: "slowPeriod",
      label: "Slow Period",
      type: "integer",
      required: true,
      defaultValue: 50,
      min: 5,
      max: 500,
      step: 1,
      group: "SMA",
    },
  ];

  onStart(_params: Record<string, number>): void {}
  onStop(): void {}

  onCandle(candle: CandleRow, ctx: StrategyContext): Signal | null {
    const { position, candles, params } = ctx;
    const fastPeriod = params.fastPeriod ?? this.defaultParams.fastPeriod;
    const slowPeriod = params.slowPeriod ?? this.defaultParams.slowPeriod;

    // Need at least slowPeriod + 1 candles to detect a crossover (compare last 2 values)
    if (candles.length < slowPeriod + 1) return null;

    const closes = candles.map((c) => c.close);
    const fastSma = sma(closes, fastPeriod);
    const slowSma = sma(closes, slowPeriod);

    const last = closes.length - 1;
    const prev = last - 1;

    const fastCurr = fastSma[last]!;
    const fastPrev = fastSma[prev]!;
    const slowCurr = slowSma[last]!;
    const slowPrev = slowSma[prev]!;

    if (isNaN(fastCurr) || isNaN(fastPrev) || isNaN(slowCurr) || isNaN(slowPrev)) {
      return null;
    }

    const crossedAbove = fastPrev <= slowPrev && fastCurr > slowCurr;
    const crossedBelow = fastPrev >= slowPrev && fastCurr < slowCurr;

    if (!position && crossedAbove) {
      return {
        action: "BUY",
        quantity: 1,
        price: candle.close,
        reason: `SMA${fastPeriod} crossed above SMA${slowPeriod}`,
      };
    }

    if (position && crossedBelow) {
      return {
        action: "SELL",
        quantity: position.quantity,
        price: candle.close,
        reason: `SMA${fastPeriod} crossed below SMA${slowPeriod}`,
      };
    }

    return null;
  }
}
