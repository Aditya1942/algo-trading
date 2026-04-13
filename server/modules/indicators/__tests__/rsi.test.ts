import { describe, test, expect } from "bun:test";
import { rsi } from "../rsi.ts";

describe("rsi", () => {
  test("first period elements are NaN", () => {
    const data = [44, 46, 48, 46, 44, 46, 48, 50, 48, 46, 48, 50, 52, 50, 48];
    const result = rsi(data, 14);
    for (let i = 0; i < 14; i++) {
      expect(isNaN(result[i]!)).toBe(true);
    }
  });

  test("RSI values are between 0 and 100", () => {
    const data = [44, 46, 48, 46, 44, 46, 48, 50, 48, 46, 48, 50, 52, 50, 48, 50];
    const result = rsi(data, 14);
    const valid = result.filter((v) => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
    for (const v of valid) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  test("all gains → RSI approaches 100", () => {
    // all prices going up: avg_loss = 0, RSI = 100
    const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    const result = rsi(data, 14);
    const last = result[result.length - 1]!;
    expect(last).toBeCloseTo(100, 4);
  });

  test("all losses → RSI approaches 0", () => {
    // all prices going down: avg_gain = 0, RSI = 0
    const data = [24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
    const result = rsi(data, 14);
    const last = result[result.length - 1]!;
    expect(last).toBeCloseTo(0, 4);
  });

  test("returns array same length as input", () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = rsi(data, 14);
    expect(result.length).toBe(data.length);
  });

  test("throws when period < 1", () => {
    expect(() => rsi([1, 2, 3], 0)).toThrow();
  });

  test("period=1 computes RSI from second element onward", () => {
    // with period=1, first NaN count = 1
    const data = [10, 20, 15];
    const result = rsi(data, 1);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(false);
    expect(isNaN(result[2]!)).toBe(false);
  });

  test("neutral market converges toward 50 with more data", () => {
    // alternating up/down by same amount — with Wilder's smoothing,
    // RSI converges to 50 as sequence lengthens. With 60 points it's very close.
    const data: number[] = [];
    for (let i = 0; i < 60; i++) {
      data.push(i % 2 === 0 ? 10 : 11);
    }
    const result = rsi(data, 14);
    const last = result[result.length - 1]!;
    // After many cycles, should be within 5 of 50
    expect(last).toBeGreaterThan(45);
    expect(last).toBeLessThan(55);
  });
});
