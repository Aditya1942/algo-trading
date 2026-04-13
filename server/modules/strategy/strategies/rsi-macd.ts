import { rsi, macd } from "../../indicators/index.ts";
import { Strategy } from "../base-strategy.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { Signal, StrategyContext } from "../types.ts";

export class RsiMacdStrategy extends Strategy {
  name = "rsi-macd";
  description =
    "Combines RSI oversold/overbought levels with MACD histogram crossovers for entry/exit signals.";
  defaultParams = {
    rsiPeriod: 14,
    rsiBuy: 30,
    rsiSell: 70,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
  };

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
