import { describe, test, expect } from "bun:test";
import { ema } from "../ema.ts";

describe("ema", () => {
  test("returns NaN for first period-1 elements", () => {
    const result = ema([1, 2, 3, 4, 5], 3);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(true);
  });

  test("first valid EMA equals SMA of first period values", () => {
    // period=3, first valid EMA at index 2 = SMA([1,2,3]) = 2
    const result = ema([1, 2, 3, 4, 5], 3);
    expect(result[2]).toBeCloseTo(2, 6);
  });

  test("applies EMA multiplier correctly", () => {
    // multiplier = 2/(3+1) = 0.5
    // EMA[2] = 2 (SMA seed)
    // EMA[3] = 4 * 0.5 + 2 * 0.5 = 3
    // EMA[4] = 5 * 0.5 + 3 * 0.5 = 4
    const result = ema([1, 2, 3, 4, 5], 3);
    expect(result[3]).toBeCloseTo(3, 6);
    expect(result[4]).toBeCloseTo(4, 6);
  });

  test("returns array same length as input", () => {
    const input = [10, 20, 30, 40, 50];
    const result = ema(input, 2);
    expect(result.length).toBe(input.length);
  });

  test("period=1 returns same values (multiplier=1)", () => {
    const input = [5, 10, 15, 20];
    const result = ema(input, 1);
    expect(result[0]).toBeCloseTo(5, 6);
    expect(result[1]).toBeCloseTo(10, 6);
    expect(result[2]).toBeCloseTo(15, 6);
    expect(result[3]).toBeCloseTo(20, 6);
  });

  test("throws when period < 1", () => {
    expect(() => ema([1, 2, 3], 0)).toThrow();
  });

  test("throws when period > values.length", () => {
    expect(() => ema([1, 2], 5)).toThrow();
  });

  test("EMA reacts faster to recent prices than SMA", () => {
    // Spike at end: EMA should be higher than SMA
    const data = [10, 10, 10, 10, 100];
    const emaResult = ema(data, 3);
    const lastEma = emaResult[4]!;
    // EMA[4] = 100 * 0.5 + EMA[3] * 0.5
    // EMA[2] = 10 (SMA), EMA[3] = 10*0.5+10*0.5=10, EMA[4]=100*0.5+10*0.5=55
    expect(lastEma).toBeGreaterThan(30); // more reactive than simple avg
  });
});
