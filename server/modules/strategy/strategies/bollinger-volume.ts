import { bollingerBands } from "../../indicators/index.ts";
import { Strategy } from "../base-strategy.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { Signal, StrategyContext } from "../types.ts";

export class BollingerVolumeStrategy extends Strategy {
  name = "bollinger-volume";
  description =
    "Buys on lower Bollinger Band touch with high volume spike; sells when price reaches upper band.";
  defaultParams = { bbPeriod: 20, bbStdDev: 2, volumeMultiplier: 1.5 };

  onStart(_params: Record<string, number>): void {}
  onStop(): void {}

  onCandle(candle: CandleRow, ctx: StrategyContext): Signal | null {
    const { position, candles, params } = ctx;
    const bbPeriod = params.bbPeriod ?? this.defaultParams.bbPeriod;
    const bbStdDev = params.bbStdDev ?? this.defaultParams.bbStdDev;
    const volumeMultiplier =
      params.volumeMultiplier ?? this.defaultParams.volumeMultiplier;

    if (candles.length < bbPeriod) return null;

    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const bands = bollingerBands(closes, bbPeriod, bbStdDev);

    const last = closes.length - 1;
    const currBand = bands[last]!;

    if (isNaN(currBand.upper) || isNaN(currBand.lower)) return null;

    // Average volume over available window
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const currentVolume = candle.volume;
    const currentClose = candle.close;

    if (
      !position &&
      currentClose <= currBand.lower &&
      currentVolume > avgVolume * volumeMultiplier
    ) {
      return {
        action: "BUY",
        quantity: 1,
        price: currentClose,
        reason: `Price ${currentClose} at/below lower BB ${currBand.lower.toFixed(2)} with volume spike (${currentVolume} > ${(avgVolume * volumeMultiplier).toFixed(0)})`,
      };
    }

    if (position && currentClose >= currBand.upper) {
      return {
        action: "SELL",
        quantity: position.quantity,
        price: currentClose,
        reason: `Price ${currentClose} at/above upper BB ${currBand.upper.toFixed(2)}`,
      };
    }

    return null;
  }
}
