/**
 * Simple Moving Average
 * Returns array same length as input.
 * First `period - 1` elements are NaN.
 */
export function sma(values: number[], period: number): number[] {
  if (period < 1) throw new Error(`sma: period must be >= 1, got ${period}`);
  if (period > values.length)
    throw new Error(
      `sma: period (${period}) must be <= values.length (${values.length})`
    );

  const result: number[] = new Array(values.length).fill(NaN);

  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j]!;
    }
    result[i] = sum / period;
  }

  return result;
}
