import { describe, test, expect } from "bun:test";
import { bollingerBands } from "../bollinger.ts";

describe("bollingerBands", () => {
  test("returns array same length as input", () => {
    const data = Array.from({ length: 25 }, (_, i) => i + 1);
    const result = bollingerBands(data);
    expect(result.length).toBe(data.length);
  });

  test("NaN for first period-1 elements with default period=20", () => {
    const data = Array.from({ length: 25 }, (_, i) => i + 1);
    const result = bollingerBands(data);
    for (let i = 0; i < 19; i++) {
      expect(isNaN(result[i]!.upper)).toBe(true);
      expect(isNaN(result[i]!.middle)).toBe(true);
      expect(isNaN(result[i]!.lower)).toBe(true);
    }
  });

  test("middle band equals SMA", () => {
    const data = [1, 2, 3, 4, 5, 6, 7];
    const result = bollingerBands(data, 3);
    // SMA(3) at index 2 = (1+2+3)/3 = 2
    expect(result[2]!.middle).toBeCloseTo(2, 6);
    // SMA(3) at index 4 = (3+4+5)/3 = 4
    expect(result[4]!.middle).toBeCloseTo(4, 6);
  });

  test("upper > middle > lower for volatile data", () => {
    const data = [1, 3, 2, 5, 3, 7, 2, 4, 6, 3, 5, 7, 2, 4, 6, 3, 5, 7, 2, 4, 6];
    const result = bollingerBands(data, 5);
    const valid = result.filter((r) => !isNaN(r.upper));
    expect(valid.length).toBeGreaterThan(0);
    for (const r of valid) {
      expect(r.upper).toBeGreaterThan(r.middle);
      expect(r.middle).toBeGreaterThan(r.lower);
    }
  });

  test("constant data → bands collapse to same value", () => {
    const data = Array.from({ length: 25 }, () => 10);
    const result = bollingerBands(data, 5);
    const valid = result.filter((r) => !isNaN(r.upper));
    for (const r of valid) {
      expect(r.upper).toBeCloseTo(10, 6);
      expect(r.middle).toBeCloseTo(10, 6);
      expect(r.lower).toBeCloseTo(10, 6);
    }
  });

  test("custom stdDev multiplier widens/narrows bands proportionally", () => {
    const data = [2, 4, 3, 5, 2, 4, 3, 5, 2, 4, 3, 5, 2, 4, 3];
    const r1 = bollingerBands(data, 5, 1);
    const r2 = bollingerBands(data, 5, 2);
    const valid1 = r1.filter((r) => !isNaN(r.upper));
    const valid2 = r2.filter((r) => !isNaN(r.upper));
    // Width of band2 should be ~2x width of band1
    if (valid1.length > 0 && valid2.length > 0) {
      const width1 = valid1[0]!.upper - valid1[0]!.lower;
      const width2 = valid2[0]!.upper - valid2[0]!.lower;
      expect(width2).toBeCloseTo(width1 * 2, 6);
    }
  });

  test("default params: period=20, stdDev=2", () => {
    const data = Array.from({ length: 25 }, (_, i) => i + 1);
    const defaultResult = bollingerBands(data);
    const explicitResult = bollingerBands(data, 20, 2);
    for (let i = 0; i < data.length; i++) {
      const d = defaultResult[i]!;
      const e = explicitResult[i]!;
      if (!isNaN(d.upper)) {
        expect(d.upper).toBeCloseTo(e.upper, 10);
        expect(d.middle).toBeCloseTo(e.middle, 10);
        expect(d.lower).toBeCloseTo(e.lower, 10);
      }
    }
  });

  test("band width increases with higher volatility", () => {
    const lowVol = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 0.1 : -0.1));
    const highVol = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10));
    const lowResult = bollingerBands(lowVol, 5);
    const highResult = bollingerBands(highVol, 5);
    const lowValid = lowResult.filter((r) => !isNaN(r.upper));
    const highValid = highResult.filter((r) => !isNaN(r.upper));
    const lowWidth = lowValid[0]!.upper - lowValid[0]!.lower;
    const highWidth = highValid[0]!.upper - highValid[0]!.lower;
    expect(highWidth).toBeGreaterThan(lowWidth);
  });
});
