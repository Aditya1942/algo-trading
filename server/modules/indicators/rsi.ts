/**
 * Relative Strength Index (Wilder's smoothing method)
 * First `period` elements are NaN — need period+1 values to compute first RSI.
 */
export function rsi(values: number[], period: number): number[] {
  if (period < 1) throw new Error(`rsi: period must be >= 1, got ${period}`);

  const result: number[] = new Array(values.length).fill(NaN);

  if (values.length <= period) return result;

  // Compute initial average gain/loss over first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI at index `period`
  result[period] =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Subsequent RSIs via Wilder's smoothing
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}
