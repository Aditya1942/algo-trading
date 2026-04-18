import { Strategy } from "./base-strategy.ts";
import type { CandleRow } from "../market-data/types.ts";
import type { Signal, StrategyContext } from "./types.ts";
import type { StrategyParamSpec } from "../../shared/contracts/index.ts";
import type { CustomStrategyRow } from "./custom-db.ts";

const CANDLE_TIMEOUT_MS = Number(process.env.CUSTOM_STRATEGY_CANDLE_TIMEOUT_MS ?? 500);
const INIT_TIMEOUT_MS = Number(process.env.CUSTOM_STRATEGY_INIT_TIMEOUT_MS ?? 2000);
const STOP_TIMEOUT_MS = 500;

type PendingResolver = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class CustomStrategyProxy extends Strategy {
  name: string;
  description: string;
  paramSpecs: StrategyParamSpec[];
  supportedIntervals?: ("1d" | "1h" | "1m")[];
  supportedModes?: ("backtest" | "paper" | "live")[] = ["backtest"];

  private worker: Worker | null = null;
  private code: string;
  private pending: PendingResolver | null = null;
  private logs: string[] = [];
  private lastError: string | null = null;

  constructor(row: CustomStrategyRow) {
    super();
    this.name = `custom:${row.id}`;
    this.description = row.description;
    this.paramSpecs = row.paramSpecs;
    this.supportedIntervals = row.supportedIntervals;
    this.code = row.code;
  }

  private call<T>(msg: unknown, timeoutMs: number): Promise<T> {
    if (!this.worker) return Promise.reject(new Error("Worker not running"));
    const w = this.worker;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        try {
          w.terminate();
        } catch {}
        this.worker = null;
        reject(new Error(`Custom strategy timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending = {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      };
      w.postMessage(msg);
    });
  }

  async onStart(params: Record<string, number>): Promise<void> {
    const w = new Worker(new URL("./custom-worker.ts", import.meta.url).href, {
      type: "module",
    } as WorkerOptions);

    w.addEventListener("message", (ev: MessageEvent) => {
      const data = ev.data as { type: string; error?: string; [k: string]: unknown };
      const p = this.pending;
      if (!p) return;
      clearTimeout(p.timer);
      this.pending = null;
      if (data.type === "error") {
        this.lastError = data.error ?? "unknown error";
        p.reject(new Error(this.lastError));
      } else {
        p.resolve(data);
      }
    });

    w.addEventListener("error", (ev: ErrorEvent) => {
      const p = this.pending;
      if (p) {
        clearTimeout(p.timer);
        this.pending = null;
        p.reject(new Error(String(ev.message ?? "worker error")));
      }
    });

    this.worker = w;
    await this.call({ type: "init", code: this.code, params }, INIT_TIMEOUT_MS);
  }

  async onCandle(candle: CandleRow, ctx: StrategyContext): Promise<Signal | null> {
    if (!this.worker) return null;
    const result = await this.call<{ signal: Signal | null; logs: string[] }>(
      {
        type: "candle",
        candle,
        window: ctx.candles,
        position: ctx.position,
        balance: ctx.balance,
        initialBalance: ctx.initialBalance,
        riskLimits: ctx.riskLimits,
        params: ctx.params,
      },
      CANDLE_TIMEOUT_MS,
    );
    if (result.logs.length > 0) this.logs.push(...result.logs);
    return result.signal;
  }

  async onStop(): Promise<void> {
    if (!this.worker) return;
    try {
      await this.call({ type: "stop" }, STOP_TIMEOUT_MS);
    } catch {
      // ignore
    }
    try {
      this.worker.terminate();
    } catch {}
    this.worker = null;
  }

  getLogs(): string[] {
    return this.logs;
  }
}
