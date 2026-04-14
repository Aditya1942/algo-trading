import { describe, test, expect } from "bun:test";
import { sma } from "../sma.ts";

describe("sma", () => {
  test("returns NaN for first period-1 elements", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(true);
  });

  test("computes correct SMA values", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result[2]).toBe(2); // (1+2+3)/3
    expect(result[3]).toBe(3); // (2+3+4)/3
    expect(result[4]).toBe(4); // (3+4+5)/3
  });

  test("returns array same length as input", () => {
    const input = [10, 20, 30, 40, 50];
    const result = sma(input, 2);
    expect(result.length).toBe(input.length);
  });

  test("period=1 returns same values", () => {
    const input = [5, 10, 15, 20];
    const result = sma(input, 1);
    expect(result[0]).toBe(5);
    expect(result[1]).toBe(10);
    expect(result[2]).toBe(15);
    expect(result[3]).toBe(20);
  });

  test("period equals length returns single valid value", () => {
    const result = sma([2, 4, 6, 8], 4);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(true);
    expect(isNaN(result[2]!)).toBe(true);
    expect(result[3]).toBe(5); // (2+4+6+8)/4
  });

  test("throws when period < 1", () => {
    expect(() => sma([1, 2, 3], 0)).toThrow();
  });

  test("throws when period > values.length", () => {
    expect(() => sma([1, 2], 5)).toThrow();
  });

  test("handles single element with period=1", () => {
    const result = sma([42], 1);
    expect(result[0]).toBe(42);
  });
});
