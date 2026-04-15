import { rsi, macd } from "../../indicators/index.ts";
import { Strategy } from "../base-strategy.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { Signal, StrategyContext } from "../types.ts";
import type { StrategyParamSpec } from "../../../shared/contracts/index.ts";

export class RsiMacdStrategy extends Strategy {
  name = "rsi-macd";
  description =
    "Combines RSI oversold/overbought levels with MACD histogram crossovers for entry/exit signals.";
  paramSpecs: StrategyParamSpec[] = [
    {
      key: "rsiPeriod",
      label: "RSI Period",
      type: "integer",
      required: true,
      defaultValue: 14,
      min: 2,
      max: 100,
      step: 1,
      group: "RSI",
    },
    {
      key: "rsiBuy",
      label: "RSI Buy Threshold",
      type: "integer",
      required: true,
      defaultValue: 30,
      min: 1,
      max: 50,
      step: 1,
      group: "RSI",
    },
    {
      key: "rsiSell",
      label: "RSI Sell Threshold",
      type: "integer",
      required: true,
      defaultValue: 70,
      min: 50,
      max: 99,
      step: 1,
      group: "RSI",
    },
    {
      key: "macdFast",
      label: "MACD Fast Period",
      type: "integer",
      required: true,
      defaultValue: 12,
      min: 2,
      max: 100,
      step: 1,
      group: "MACD",
    },
    {
      key: "macdSlow",
      label: "MACD Slow Period",
      type: "integer",
      required: true,
      defaultValue: 26,
      min: 3,
      max: 200,
      step: 1,
      group: "MACD",
    },
    {
      key: "macdSignal",
      label: "MACD Signal Period",
      type: "integer",
      required: true,
      defaultValue: 9,
      min: 1,
      max: 50,
      step: 1,
      group: "MACD",
    },
  ];

  onStart(_params: Record<string, number>): void {}
  onStop(): void {}

  onCandle(candle: CandleRow, ctx: StrategyContext): Signal | null {
    const { position, candles, params } = ctx;
    const rsiPeriod = params.rsiPeriod ?? this.defaultParams.rsiPeriod;
    const rsiBuy = params.rsiBuy ?? this.defaultParams.rsiBuy;
    const rsiSell = params.rsiSell ?? this.defaultParams.rsiSell;
    const macdFast = params.macdFast ?? this.defaultParams.macdFast;
    const macdSlow = params.macdSlow ?? this.defaultParams.macdSlow;
    const macdSignalPeriod = params.macdSignal ?? this.defaultParams.macdSignal;

    // Need at least macdSlow + macdSignal + 1 for crossover detection
    const minCandles = macdSlow + macdSignalPeriod + 1;
    if (candles.length < minCandles) return null;

    const closes = candles.map((c) => c.close);
    const rsiValues = rsi(closes, rsiPeriod);
    const macdValues = macd(closes, macdFast, macdSlow, macdSignalPeriod);

    const last = closes.length - 1;
    const prev = last - 1;

    const currRsi = rsiValues[last]!;
    const currHist = macdValues[last]!.histogram;
    const prevHist = macdValues[prev]!.histogram;

    if (isNaN(currRsi) || isNaN(currHist) || isNaN(prevHist)) return null;

    const histCrossedPositive = prevHist <= 0 && currHist > 0;
    const histCrossedNegative = prevHist >= 0 && currHist < 0;

    if (!position && currRsi < rsiBuy && histCrossedPositive) {
      return {
        action: "BUY",
        quantity: 1,
        price: candle.close,
        reason: `RSI(${rsiPeriod})=${currRsi.toFixed(1)} < ${rsiBuy} and MACD histogram crossed positive`,
      };
    }

    if (position && currRsi > rsiSell && histCrossedNegative) {
      return {
        action: "SELL",
        quantity: position.quantity,
        price: candle.close,
        reason: `RSI(${rsiPeriod})=${currRsi.toFixed(1)} > ${rsiSell} and MACD histogram crossed negative`,
      };
    }

    return null;
  }
}
