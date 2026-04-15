import { describe, test, expect } from "bun:test";
import { RsiMacdStrategy } from "../strategies/rsi-macd.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { StrategyContext } from "../types.ts";

function makeCandle(close: number, i: number): CandleRow {
  return {
    instrument_key: "NSE_EQ|INE001A01036",
    timestamp: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T09:30:00+05:30`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    oi: 0,
  };
}

// Params chosen so that minCandles = macdSlow + macdSignal + 1 = 6+3+1=10
// which our 9-candle series satisfies (length=9 >= minCandles is NOT satisfied — need 10).
// So we use macdSlow=6, macdSignal=2 → minCandles=6+2+1=9 exactly.
const params = {
  rsiPeriod: 5,
  rsiBuy: 35,
  rsiSell: 65,
  macdFast: 3,
  macdSlow: 6,
  macdSignal: 2,
};

/**
 * BUY candles: verified to produce RSI(5)=20 < 35 AND MACD(3,6,3) hist crosses positive.
 * Prices: [100,99,98,97,96,95,94,93,94]
 * (decline then one step down then bounce of 1)
 * prevHist=0.0000 (<=0), currHist=0.2143 (>0), rsi=20.00
 *
 * Note: macdSignal=2 instead of 3 so we have enough data (need macdSlow+macdSignal+1=9 candles).
 */
const BUY_PRICES = [100, 99, 98, 97, 96, 95, 94, 93, 94];

/**
 * SELL candles: verified to produce RSI(5)=80 > 65 AND MACD hist crosses negative.
 * Prices: [100,101,102,103,104,105,106,107,106]
 * prevHist=0.0000 (>=0), currHist=-0.2143 (<0), rsi=80.00
 */
const SELL_PRICES = [100, 101, 102, 103, 104, 105, 106, 107, 106];

describe("RsiMacdStrategy", () => {
  test("emits BUY when RSI oversold and MACD histogram crosses positive (no position)", () => {
    const strategy = new RsiMacdStrategy();
    const candles = BUY_PRICES.map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("BUY");
    expect(signal!.price).toBe(94);
    expect(signal!.reason).toContain("RSI");
    expect(signal!.reason).toContain("MACD");
  });

  test("emits SELL when RSI overbought and MACD histogram crosses negative (with position)", () => {
    const strategy = new RsiMacdStrategy();
    const candles = SELL_PRICES.map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = {
      position: { entryPrice: 100, quantity: 3, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("SELL");
    expect(signal!.quantity).toBe(3);
    expect(signal!.price).toBe(106);
  });

  test("no BUY signal when position already open even if buy conditions are met", () => {
    const strategy = new RsiMacdStrategy();
    const candles = BUY_PRICES.map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = {
      position: { entryPrice: 90, quantity: 1, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("no SELL signal when no position even if sell conditions are met", () => {
    const strategy = new RsiMacdStrategy();
    const candles = SELL_PRICES.map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("returns null when insufficient candles", () => {
    const strategy = new RsiMacdStrategy();
    // Only 5 candles — below minCandles
    const candles = [100, 105, 110, 108, 103].map((p, i) => makeCandle(p, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("no signal on neutral prices (RSI mid-range, histogram not crossing)", () => {
    const strategy = new RsiMacdStrategy();
    // Flat prices → RSI neutral (~50), histogram ~0 but not crossing
    const candles = [100, 101, 100, 101, 100, 101, 100, 101, 100].map((p, i) =>
      makeCandle(p, i)
    );
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("strategy has correct metadata", () => {
    const s = new RsiMacdStrategy();
    expect(s.name).toBe("rsi-macd");
    expect(s.defaultParams.rsiPeriod).toBe(14);
    expect(s.defaultParams.macdFast).toBe(12);
    expect(s.defaultParams.macdSlow).toBe(26);
    expect(s.defaultParams.macdSignal).toBe(9);
    expect(s.paramSpecs).toHaveLength(6);
    expect(s.paramSpecs.map((spec) => spec.group)).toContain("RSI");
    expect(s.paramSpecs.map((spec) => spec.group)).toContain("MACD");
  });
});
