import { describe, test, expect } from "bun:test";
import { SmaCrossoverStrategy } from "../strategies/sma-crossover.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { StrategyContext } from "../types.ts";

function makeCandle(close: number, i = 0): CandleRow {
  return {
    instrument_key: "NSE_EQ|INE001A01036",
    timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T09:30:00+05:30`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    oi: 0,
  };
}

/**
 * Build a candle array that causes SMA(fast) to cross ABOVE SMA(slow).
 * Strategy: fast=3, slow=5.
 * Need slowPeriod+1 = 6 candles total.
 *
 * We construct prices so:
 *  - prev[last-1]: fastSma <= slowSma
 *  - curr[last]:   fastSma >  slowSma
 *
 * Simple approach: start low, end with a sharp spike so fast catches up.
 */
function makeBuyCandles(fastPeriod = 3, slowPeriod = 5): CandleRow[] {
  // Need slowPeriod+1 candles. Use prices that cause golden cross on last.
  // First (slowPeriod-1) candles: flat low price → fast ≈ slow ≈ low
  // Last 2 candles: spike high so fast sma rises above slow
  const n = slowPeriod + 1;
  const prices: number[] = [];
  for (let i = 0; i < n - 2; i++) prices.push(100);
  prices.push(100); // prev: still flat → fast ≈ slow
  prices.push(200); // curr: big spike → fast jumps above slow
  return prices.map((p, i) => makeCandle(p, i));
}

/**
 * Build a candle array that causes SMA(fast) to cross BELOW SMA(slow) — death cross.
 * Mirror of above: start high, end with sharp drop.
 */
function makeSellCandles(fastPeriod = 3, slowPeriod = 5): CandleRow[] {
  const n = slowPeriod + 1;
  const prices: number[] = [];
  for (let i = 0; i < n - 2; i++) prices.push(200);
  prices.push(200);
  prices.push(100); // sharp drop → fast dips below slow
  return prices.map((p, i) => makeCandle(p, i));
}

const params = { fastPeriod: 3, slowPeriod: 5 };

describe("SmaCrossoverStrategy", () => {
  test("emits BUY on golden cross when no position", () => {
    const strategy = new SmaCrossoverStrategy();
    const candles = makeBuyCandles(3, 5);
    const ctx: StrategyContext = {
      position: null,
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("BUY");
    expect(signal!.price).toBe(200);
    expect(signal!.reason).toContain("SMA3");
    expect(signal!.reason).toContain("SMA5");
  });

  test("emits SELL on death cross when position is open", () => {
    const strategy = new SmaCrossoverStrategy();
    const candles = makeSellCandles(3, 5);
    const ctx: StrategyContext = {
      position: { entryPrice: 200, quantity: 5, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("SELL");
    expect(signal!.quantity).toBe(5);
  });

  test("no signal when golden cross occurs but position already open", () => {
    const strategy = new SmaCrossoverStrategy();
    const candles = makeBuyCandles(3, 5);
    const ctx: StrategyContext = {
      position: { entryPrice: 100, quantity: 1, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("no signal when death cross occurs but no position", () => {
    const strategy = new SmaCrossoverStrategy();
    const candles = makeSellCandles(3, 5);
    const ctx: StrategyContext = {
      position: null,
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("returns null when insufficient candles (below slowPeriod+1)", () => {
    const strategy = new SmaCrossoverStrategy();
    // Only 4 candles but slowPeriod=5 needs 6
    const candles = [100, 110, 120, 130].map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("no signal on flat prices (no crossover)", () => {
    const strategy = new SmaCrossoverStrategy();
    // All same price → SMAs equal, no cross
    const candles = [100, 100, 100, 100, 100, 100].map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("strategy has correct metadata", () => {
    const s = new SmaCrossoverStrategy();
    expect(s.name).toBe("sma-crossover");
    expect(s.defaultParams.fastPeriod).toBe(10);
    expect(s.defaultParams.slowPeriod).toBe(50);
  });
});
