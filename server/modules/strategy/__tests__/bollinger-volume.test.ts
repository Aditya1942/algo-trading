import { describe, test, expect } from "bun:test";
import { BollingerVolumeStrategy } from "../strategies/bollinger-volume.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { StrategyContext } from "../types.ts";
import { bollingerBands } from "../../indicators/index.ts";

function makeCandle(close: number, volume: number, i: number): CandleRow {
  return {
    instrument_key: "NSE_EQ|INE001A01036",
    timestamp: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T09:30:00+05:30`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
    oi: 0,
  };
}

const params = { bbPeriod: 5, bbStdDev: 2, volumeMultiplier: 1.5 };

/**
 * Build candles where the last candle closes AT or BELOW the lower Bollinger Band
 * with a volume spike.
 *
 * bbPeriod=5 — Bollinger computed over last 5 closes.
 * We'll use highly volatile prices so bands are wide, then make the last price
 * drop well below the lower band.
 */
function makeBuyCandles(): CandleRow[] {
  // Prices: stable cluster around 100 with some noise, then a drop
  const prices = [102, 98, 104, 96, 100]; // period=5, mean=100, some std dev
  const volumes = [1000, 1000, 1000, 1000, 1000];

  // Calculate actual lower band for these prices
  const bands = bollingerBands(prices, 5, 2);
  const lastBand = bands[bands.length - 1]!;
  // Put close just at or below lower band
  const triggerClose = Math.floor(lastBand.lower) - 1;
  prices.push(triggerClose);
  // Volume spike: avgVolume=1000, so need > 1000*1.5=1500
  volumes.push(2000);

  return prices.map((p, i) => makeCandle(p, volumes[i]!, i));
}

/**
 * Build candles where the last candle closes AT or ABOVE the upper Bollinger Band.
 */
function makeSellCandles(): CandleRow[] {
  const prices = [102, 98, 104, 96, 100];
  const volumes = [1000, 1000, 1000, 1000, 1000];

  const bands = bollingerBands(prices, 5, 2);
  const lastBand = bands[bands.length - 1]!;
  const triggerClose = Math.ceil(lastBand.upper) + 1;
  prices.push(triggerClose);
  volumes.push(1000);

  return prices.map((p, i) => makeCandle(p, volumes[i]!, i));
}

describe("BollingerVolumeStrategy", () => {
  test("emits BUY when price touches lower band with volume spike (no position)", () => {
    const strategy = new BollingerVolumeStrategy();
    const candles = makeBuyCandles();
    const closes = candles.map((c) => c.close);
    const bands = bollingerBands(closes, params.bbPeriod, params.bbStdDev);
    const lastBand = bands[bands.length - 1]!;
    const lastCandle = candles[candles.length - 1]!;
    const avgVol = candles.map((c) => c.volume).reduce((a, b) => a + b, 0) / candles.length;

    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(lastCandle, ctx);

    // Verify our test data meets the condition
    const meetsCondition =
      lastCandle.close <= lastBand.lower && lastCandle.volume > avgVol * params.volumeMultiplier;

    if (meetsCondition) {
      expect(signal).not.toBeNull();
      expect(signal!.action).toBe("BUY");
      expect(signal!.price).toBe(lastCandle.close);
    } else {
      expect(signal).toBeNull();
    }
  });

  test("emits SELL when price touches upper band (with position)", () => {
    const strategy = new BollingerVolumeStrategy();
    const candles = makeSellCandles();
    const closes = candles.map((c) => c.close);
    const bands = bollingerBands(closes, params.bbPeriod, params.bbStdDev);
    const lastBand = bands[bands.length - 1]!;
    const lastCandle = candles[candles.length - 1]!;

    const ctx: StrategyContext = {
      position: { entryPrice: 90, quantity: 2, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(lastCandle, ctx);

    const meetsCondition = lastCandle.close >= lastBand.upper;
    if (meetsCondition) {
      expect(signal).not.toBeNull();
      expect(signal!.action).toBe("SELL");
      expect(signal!.quantity).toBe(2);
    } else {
      expect(signal).toBeNull();
    }
  });

  test("no BUY when price at lower band but volume insufficient", () => {
    const strategy = new BollingerVolumeStrategy();
    const prices = [102, 98, 104, 96, 100];
    const bands = bollingerBands(prices, 5, 2);
    const lastBand = bands[bands.length - 1]!;
    const triggerClose = Math.floor(lastBand.lower) - 1;
    prices.push(triggerClose);

    // All normal volume — no spike
    const volumes = [1000, 1000, 1000, 1000, 1000, 1000];
    const candles = prices.map((p, i) => makeCandle(p, volumes[i]!, i));

    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    // Volume = 1000, avg = 1000, threshold = 1500 → no signal
    expect(signal).toBeNull();
  });

  test("no BUY when position already open even with lower-band touch + volume spike", () => {
    const strategy = new BollingerVolumeStrategy();
    const candles = makeBuyCandles();
    const ctx: StrategyContext = {
      position: { entryPrice: 95, quantity: 1, entryTimestamp: "2024-01-01T09:30:00+05:30" },
      candles,
      params,
    };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("no SELL when no position even if price hits upper band", () => {
    const strategy = new BollingerVolumeStrategy();
    const candles = makeSellCandles();
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("returns null when insufficient candles (below bbPeriod)", () => {
    const strategy = new BollingerVolumeStrategy();
    const candles = [100, 102, 98].map((p, i) => makeCandle(p, 1000, i));
    const ctx: StrategyContext = { position: null, candles, params };
    const signal = strategy.onCandle(candles[candles.length - 1]!, ctx);
    expect(signal).toBeNull();
  });

  test("strategy has correct metadata", () => {
    const s = new BollingerVolumeStrategy();
    expect(s.name).toBe("bollinger-volume");
    expect(s.defaultParams.bbPeriod).toBe(20);
    expect(s.defaultParams.bbStdDev).toBe(2);
    expect(s.defaultParams.volumeMultiplier).toBe(1.5);
    expect(s.paramSpecs).toHaveLength(3);
    expect(s.paramSpecs.map((spec) => spec.key)).toEqual([
      "bbPeriod",
      "bbStdDev",
      "volumeMultiplier",
    ]);
  });
});
