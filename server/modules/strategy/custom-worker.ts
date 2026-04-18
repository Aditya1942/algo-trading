/// <reference lib="webworker" />
import * as indicators from "../indicators/index.ts";

// Duck-typed base. User code `class extends Strategy` attaches own props.
class Strategy {}

interface InitMsg {
  type: "init";
  code: string;
  params: Record<string, number>;
}

interface CandleMsg {
  type: "candle";
  candle: unknown;
  window: unknown[];
  position: unknown;
  balance: number;
  initialBalance: number;
  riskLimits: unknown;
  params: Record<string, number>;
}

interface StopMsg {
  type: "stop";
}

type IncomingMsg = InitMsg | CandleMsg | StopMsg;

let userInstance: {
  onCandle: (candle: unknown, ctx: unknown) => unknown;
  onStart?: (params: Record<string, number>) => void;
  onStop?: () => void;
} | null = null;

const state: Record<string, unknown> = {};
const logs: string[] = [];

function log(...args: unknown[]): void {
  logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
}

function makeCtx(msg: CandleMsg) {
  return {
    position: msg.position,
    candles: msg.window,
    window: msg.window,
    params: msg.params,
    mode: "backtest" as const,
    balance: msg.balance,
    initialBalance: msg.initialBalance,
    riskLimits: msg.riskLimits,
    indicators,
    log,
    state,
  };
}

const g = self as unknown as {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
};

g.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as IncomingMsg;
  try {
    if (msg.type === "init") {
      let registered: (new () => typeof userInstance) | null = null;
      const registerStrategy = (cls: new () => typeof userInstance) => {
        registered = cls;
      };
      const factory = new Function(
        "Strategy",
        "indicators",
        "registerStrategy",
        "log",
        `${msg.code}\n;return typeof __cls__ !== 'undefined' ? __cls__ : undefined;`,
      );
      const maybe = factory(Strategy, indicators, registerStrategy, log);
      const Cls = registered ?? maybe;
      if (!Cls) {
        throw new Error(
          "No strategy class registered. Call registerStrategy(YourStrategyClass) at end of code, or assign to __cls__.",
        );
      }
      userInstance = new (Cls as new () => NonNullable<typeof userInstance>)();
      if (!userInstance || typeof userInstance.onCandle !== "function") {
        throw new Error("Strategy class missing onCandle method");
      }
      if (typeof userInstance.onStart === "function") {
        userInstance.onStart(msg.params);
      }
      g.postMessage({ type: "ready" });
    } else if (msg.type === "candle") {
      if (!userInstance) throw new Error("Strategy not initialized");
      logs.length = 0;
      const ctx = makeCtx(msg);
      const signal = userInstance.onCandle(msg.candle, ctx);
      g.postMessage({
        type: "signal",
        signal: signal ?? null,
        logs: logs.slice(),
      });
    } else if (msg.type === "stop") {
      if (userInstance && typeof userInstance.onStop === "function") {
        userInstance.onStop();
      }
      g.postMessage({ type: "stopped" });
    }
  } catch (err) {
    g.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
};
