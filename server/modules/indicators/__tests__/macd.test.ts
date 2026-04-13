import { describe, test, expect } from "bun:test";
import { macd } from "../macd.ts";

// Generate enough data for default MACD (slow=26, signal=9 → need 34+ points)
function linearData(n: number, start = 1, step = 1): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

describe("macd", () => {
  test("returns array same length as input", () => {
    const data = linearData(40);
    const result = macd(data);
    expect(result.length).toBe(data.length);
  });

  test("NaN for insufficient data with default params", () => {
    const data = linearData(40);
    const result = macd(data);
    // Need slow=26 EMA first valid at index 25, then signal=9 EMA → 25+8=33
    for (let i = 0; i < 33; i++) {
      expect(isNaN(result[i]!.macd)).toBe(true);
      expect(isNaN(result[i]!.signal)).toBe(true);
      expect(isNaN(result[i]!.histogram)).toBe(true);
    }
  });

  test("valid MACD values after sufficient data", () => {
    const data = linearData(40);
    const result = macd(data);
    const last = result[39]!;
    expect(isNaN(last.macd)).toBe(false);
    expect(isNaN(last.signal)).toBe(false);
    expect(isNaN(last.histogram)).toBe(false);
  });

  test("histogram = macd - signal", () => {
    const data = linearData(40);
    const result = macd(data);
    for (const r of result) {
      if (!isNaN(r.macd) && !isNaN(r.signal)) {
        expect(r.histogram).toBeCloseTo(r.macd - r.signal, 10);
      }
    }
  });

  test("custom params respected", () => {
    const data = linearData(30);
    // fast=5, slow=10, signal=3
    // MACD line valid from slow-1=9, signal EMA(3) seeds at index 9 of MACD line
    // signalEma valid at signalEma[2] → full index 9+2=11
    const result = macd(data, 5, 10, 3);
    expect(result.length).toBe(30);
    // indices before 11 should be NaN
    expect(isNaN(result[10]!.signal)).toBe(true);
    expect(isNaN(result[11]!.signal)).toBe(false);
  });

  test("linear trend: MACD line near zero for steady trend", () => {
    // On a perfectly linear sequence, fast EMA and slow EMA converge:
    // the MACD line should be a small constant (not growing unboundedly)
    const data = linearData(50);
    const result = macd(data);
    const validMacd = result.filter((r) => !isNaN(r.macd)).map((r) => r.macd);
    // All MACD values should be finite small numbers
    for (const v of validMacd) {
      expect(Math.abs(v)).toBeLessThan(10);
    }
  });

  test("default params: fast=12, slow=26, signal=9", () => {
    const data = linearData(40);
    const defaultResult = macd(data);
    const explicitResult = macd(data, 12, 26, 9);
    for (let i = 0; i < data.length; i++) {
      const d = defaultResult[i]!;
      const e = explicitResult[i]!;
      if (!isNaN(d.macd)) {
        expect(d.macd).toBeCloseTo(e.macd, 10);
        expect(d.signal).toBeCloseTo(e.signal, 10);
        expect(d.histogram).toBeCloseTo(e.histogram, 10);
      }
    }
  });
});
