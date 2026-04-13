import { sma } from "./sma.ts";
import type { BollingerResult } from "./types.ts";

/**
 * Bollinger Bands
 * Defaults: period=20, stdDev=2
 * Returns array same length as input, NaN for insufficient data.
 */
export function bollingerBands(
  values: number[],
  period = 20,
  stdDev = 2
): BollingerResult[] {
  const nan: BollingerResult = { upper: NaN, middle: NaN, lower: NaN };
  const result: BollingerResult[] = new Array(values.length)
    .fill(null)
    .map(() => ({ ...nan }));

  if (values.length < period) return result;

  const middle = sma(values, period);

  for (let i = period - 1; i < values.length; i++) {
    const mid = middle[i]!;
    // Population standard deviation over the window
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j]! - mid;
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);
    result[i] = {
      upper: mid + stdDev * sd,
      middle: mid,
      lower: mid - stdDev * sd,
    };
  }

  return result;
}
