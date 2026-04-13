import { describe, test, expect } from "bun:test";
import { getStrategy, listStrategies, registerStrategy } from "../registry.ts";
import { Strategy } from "../base-strategy.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { Signal, StrategyContext } from "../types.ts";

describe("Strategy Registry", () => {
  test("getStrategy returns correct strategy instance by name", () => {
    const s = getStrategy("sma-crossover");
    expect(s.name).toBe("sma-crossover");
  });

  test("getStrategy returns a new instance on each call", () => {
    const s1 = getStrategy("sma-crossover");
    const s2 = getStrategy("sma-crossover");
    expect(s1).not.toBe(s2);
  });

  test("getStrategy throws for unknown strategy name", () => {
    expect(() => getStrategy("nonexistent-strategy")).toThrow();
  });

  test("getStrategy throws with informative message listing available strategies", () => {
    try {
      getStrategy("nonexistent-strategy");
      expect(true).toBe(false); // should not reach here
    } catch (e) {
      expect((e as Error).message).toContain("nonexistent-strategy");
    }
  });

  test("listStrategies returns all 3 built-in strategies", () => {
    const list = listStrategies();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const names = list.map((s) => s.name);
    expect(names).toContain("sma-crossover");
    expect(names).toContain("rsi-macd");
    expect(names).toContain("bollinger-volume");
  });

  test("listStrategies entries have required metadata fields", () => {
    const list = listStrategies();
    for (const entry of list) {
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.description).toBe("string");
      expect(typeof entry.defaultParams).toBe("object");
    }
  });

  test("registerStrategy makes strategy available via getStrategy", () => {
    class TestStrategy extends Strategy {
      name = "test-strategy-unique";
      description = "A test strategy";
      defaultParams = { foo: 1 };
      onCandle(_candle: CandleRow, _ctx: StrategyContext): Signal | null {
        return null;
      }
      onStart(_params: Record<string, number>): void {}
      onStop(): void {}
    }

    registerStrategy(TestStrategy);
    const s = getStrategy("test-strategy-unique");
    expect(s.name).toBe("test-strategy-unique");
    expect(listStrategies().map((x) => x.name)).toContain("test-strategy-unique");
  });

  test("getStrategy returns rsi-macd with correct default params", () => {
    const s = getStrategy("rsi-macd");
    expect(s.defaultParams.rsiPeriod).toBe(14);
    expect(s.defaultParams.macdFast).toBe(12);
  });

  test("getStrategy returns bollinger-volume with correct default params", () => {
    const s = getStrategy("bollinger-volume");
    expect(s.defaultParams.bbPeriod).toBe(20);
    expect(s.defaultParams.volumeMultiplier).toBe(1.5);
  });
});
