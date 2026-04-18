import { describe, test, expect } from "bun:test";
import { CustomStrategyProxy } from "../custom-proxy.ts";
import type { CustomStrategyRow } from "../custom-db.ts";
import type { CandleRow } from "../../market-data/types.ts";
import type { StrategyContext } from "../types.ts";

function makeCandle(close: number, ts = "2024-01-01T00:00:00Z"): CandleRow {
  return {
    instrument_key: "TEST",
    timestamp: ts,
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
    oi: 0,
  } as CandleRow;
}

function makeRow(code: string, paramSpecs: CustomStrategyRow["paramSpecs"] = []): CustomStrategyRow {
  return {
    id: 1,
    name: "test",
    description: "",
    code,
    paramSpecs,
    supportedIntervals: ["1d"],
    createdAt: "",
    updatedAt: "",
  };
}

describe("CustomStrategyProxy", () => {
  test("executes user class and returns signal", async () => {
    const code = `
      class MyStrat extends Strategy {
        onStart(params) { this.threshold = params.threshold }
        onCandle(candle, ctx) {
          if (candle.close > this.threshold) {
            return { action: "BUY", quantity: 1, price: candle.close, reason: "above" }
          }
          return null
        }
        onStop() {}
      }
      registerStrategy(MyStrat)
    `;
    const proxy = new CustomStrategyProxy(
      makeRow(code, [
        { key: "threshold", label: "Threshold", type: "number", required: true, defaultValue: 100 },
      ]),
    );
    await proxy.onStart({ threshold: 50 });
    const ctx: StrategyContext = {
      position: null,
      candles: [makeCandle(60)],
      params: { threshold: 50 },
      mode: "backtest",
      balance: 10000,
      initialBalance: 10000,
    };
    const signal = await proxy.onCandle(makeCandle(60), ctx);
    expect(signal).not.toBeNull();
    expect(signal!.action).toBe("BUY");
    const noSignal = await proxy.onCandle(makeCandle(40), { ...ctx, candles: [makeCandle(40)] });
    expect(noSignal).toBeNull();
    await proxy.onStop();
  });

  test("throws on bad user code (no registered class)", async () => {
    const proxy = new CustomStrategyProxy(makeRow(`const x = 1;`));
    await expect(proxy.onStart({})).rejects.toThrow(/No strategy class/);
    await proxy.onStop();
  });

  test("exposes indicators helper", async () => {
    const code = `
      class IndStrat extends Strategy {
        onStart() {}
        onCandle(candle, ctx) {
          const closes = ctx.window.map(c => c.close)
          const sma = ctx.indicators.sma(closes, 3)
          ctx.log("sma", sma.at(-1))
          return null
        }
        onStop() {}
      }
      registerStrategy(IndStrat)
    `;
    const proxy = new CustomStrategyProxy(makeRow(code));
    await proxy.onStart({});
    const window = [makeCandle(10), makeCandle(20), makeCandle(30)];
    await proxy.onCandle(window[2]!, {
      position: null,
      candles: window,
      params: {},
      mode: "backtest",
      balance: 0,
      initialBalance: 0,
    });
    const logs = proxy.getLogs();
    expect(logs.some((l) => l.startsWith("sma"))).toBe(true);
    await proxy.onStop();
  });

  test("infinite loop trips timeout", async () => {
    const code = `
      class Loopy extends Strategy {
        onStart() {}
        onCandle() { while(true) {} }
        onStop() {}
      }
      registerStrategy(Loopy)
    `;
    const proxy = new CustomStrategyProxy(makeRow(code));
    await proxy.onStart({});
    await expect(
      proxy.onCandle(makeCandle(10), {
        position: null,
        candles: [makeCandle(10)],
        params: {},
        mode: "backtest",
        balance: 0,
        initialBalance: 0,
      }),
    ).rejects.toThrow(/timed out/);
  }, 10_000);
});
