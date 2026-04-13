import { sma } from "./sma.ts";

/**
 * Exponential Moving Average
 * Multiplier = 2 / (period + 1)
 * First valid EMA = SMA of first `period` values.
 * First `period - 1` elements are NaN.
 */
export function ema(values: number[], period: number): number[] {
  if (period < 1) throw new Error(`ema: period must be >= 1, got ${period}`);
  if (period > values.length)
    throw new Error(
      `ema: period (${period}) must be <= values.length (${values.length})`
    );

  const result: number[] = new Array(values.length).fill(NaN);
  const multiplier = 2 / (period + 1);

  // Seed: first valid EMA = SMA of first period values
  const seed = sma(values.slice(0, period), period);
  result[period - 1] = seed[period - 1]!;

  for (let i = period; i < values.length; i++) {
    result[i] = values[i]! * multiplier + result[i - 1]! * (1 - multiplier);
  }

  return result;
}
