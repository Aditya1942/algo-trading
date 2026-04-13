import { ema } from "./ema.ts";
import type { MacdResult } from "./types.ts";

/**
 * MACD (Moving Average Convergence Divergence)
 * Defaults: fast=12, slow=26, signal=9
 * Returns array same length as input, NaN for insufficient data.
 */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9
): MacdResult[] {
  const nan: MacdResult = { macd: NaN, signal: NaN, histogram: NaN };
  const result: MacdResult[] = new Array(values.length)
    .fill(null)
    .map(() => ({ ...nan }));

  if (values.length < slow) return result;

  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);

  // MACD line: valid from index slow-1 onward
  const macdLine: number[] = new Array(values.length).fill(NaN);
  for (let i = slow - 1; i < values.length; i++) {
    macdLine[i] = fastEma[i]! - slowEma[i]!;
  }

  // Signal line: EMA of MACD line, seeded from index slow-1
  // Only compute over the valid slice
  const macdValid = macdLine.slice(slow - 1);
  if (macdValid.length < signal) return result;

  const signalEma = ema(macdValid, signal);

  // Map back to full array indices
  // signalEma[i] corresponds to macdLine[slow-1+i]
  // First valid signal at signalEma index signal-1 → full array index slow-1+signal-1
  for (let i = 0; i < signalEma.length; i++) {
    const fullIdx = slow - 1 + i;
    const macdVal = macdLine[fullIdx]!;
    const signalVal = signalEma[i]!;
    if (!isNaN(macdVal) && !isNaN(signalVal)) {
      result[fullIdx] = {
        macd: macdVal,
        signal: signalVal,
        histogram: macdVal - signalVal,
      };
    }
  }

  return result;
}
