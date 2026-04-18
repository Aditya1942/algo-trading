// server/api/custom-strategies.ts — CRUD + validate for user-authored strategies
import { addDynamicRoute } from "./_router";
import {
  createCustom,
  deleteCustom,
  getCustom,
  listCustom,
  updateCustom,
  CustomStrategyProxy,
} from "../modules/strategy/index.ts";
import { validateStrategyParamSpec } from "../shared/contracts/index.ts";
import type { StrategyParamSpec } from "../shared/contracts/index.ts";

const VALID_INTERVALS = ["1d", "1h", "1m"] as const;

type Interval = (typeof VALID_INTERVALS)[number];

interface ParsedInput {
  name: string;
  description: string;
  code: string;
  paramSpecs: StrategyParamSpec[];
  supportedIntervals: Interval[];
}

function parseBody(body: unknown, partial: boolean): { ok: true; value: Partial<ParsedInput> } | { ok: false; errors: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["body must be an object"] };
  }
  const raw = body as Record<string, unknown>;
  const errors: string[] = [];
  const out: Partial<ParsedInput> = {};

  if (raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.trim() === "") errors.push("name must be a non-empty string");
    else out.name = raw.name;
  } else if (!partial) errors.push("name is required");

  if (raw.description !== undefined) {
    if (typeof raw.description !== "string") errors.push("description must be a string");
    else out.description = raw.description;
  }

  if (raw.code !== undefined) {
    if (typeof raw.code !== "string" || raw.code.trim() === "") errors.push("code must be a non-empty string");
    else out.code = raw.code;
  } else if (!partial) errors.push("code is required");

  if (raw.paramSpecs !== undefined) {
    if (!Array.isArray(raw.paramSpecs)) {
      errors.push("paramSpecs must be an array");
    } else {
      const specs: StrategyParamSpec[] = [];
      raw.paramSpecs.forEach((entry, idx) => {
        const result = validateStrategyParamSpec(entry);
        if (!result.ok) errors.push(...result.errors.map((e) => `paramSpecs[${idx}]: ${e}`));
        else specs.push(result.value);
      });
      if (specs.length === raw.paramSpecs.length) out.paramSpecs = specs;
    }
  }

  if (raw.supportedIntervals !== undefined) {
    if (!Array.isArray(raw.supportedIntervals) || raw.supportedIntervals.length === 0) {
      errors.push("supportedIntervals must be a non-empty array");
    } else {
      const all = raw.supportedIntervals.every(
        (i): i is Interval => typeof i === "string" && (VALID_INTERVALS as readonly string[]).includes(i),
      );
      if (!all) errors.push("supportedIntervals entries must be one of 1d, 1h, 1m");
      else out.supportedIntervals = raw.supportedIntervals as Interval[];
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

export async function handleListCustomStrategies(_req: Request): Promise<Response> {
  return Response.json({ data: listCustom() });
}

export async function handleGetCustomStrategy(_req: Request, params: Record<string, string>): Promise<Response> {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const row = getCustom(id);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function handleCreateCustomStrategy(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = parseBody(body, false);
    if (!parsed.ok) return Response.json({ error: "invalid body", details: parsed.errors }, { status: 400 });
    const v = parsed.value;
    const row = createCustom({
      name: v.name!,
      description: v.description,
      code: v.code!,
      paramSpecs: v.paramSpecs,
      supportedIntervals: v.supportedIntervals,
    });
    return Response.json({ data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function handleUpdateCustomStrategy(req: Request, params: Record<string, string>): Promise<Response> {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const parsed = parseBody(body, true);
    if (!parsed.ok) return Response.json({ error: "invalid body", details: parsed.errors }, { status: 400 });
    const row = updateCustom(id, parsed.value);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function handleDeleteCustomStrategy(_req: Request, params: Record<string, string>): Promise<Response> {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const ok = deleteCustom(id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}

export async function handleValidateCustomStrategy(_req: Request, params: Record<string, string>): Promise<Response> {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const row = getCustom(id);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  const proxy = new CustomStrategyProxy(row);
  const defaults = Object.fromEntries(row.paramSpecs.map((s) => [s.key, s.defaultValue]));
  try {
    await proxy.onStart(defaults);
    const syntheticCandle = {
      instrument_key: "SYNTHETIC",
      timestamp: new Date().toISOString(),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
      oi: 0,
    };
    const ctx = {
      position: null,
      candles: [syntheticCandle],
      params: defaults,
      mode: "backtest" as const,
      balance: 100000,
      initialBalance: 100000,
    };
    await proxy.onCandle(syntheticCandle as never, ctx as never);
    await proxy.onStop();
    return Response.json({ data: { ok: true, logs: proxy.getLogs() } });
  } catch (err) {
    try { await proxy.onStop(); } catch {}
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ data: { ok: false, error: message } });
  }
}

export function registerCustomStrategyRoutes(): void {
  addDynamicRoute("GET", "/api/v1/custom-strategies/:id", handleGetCustomStrategy);
  addDynamicRoute("PUT", "/api/v1/custom-strategies/:id", handleUpdateCustomStrategy);
  addDynamicRoute("DELETE", "/api/v1/custom-strategies/:id", handleDeleteCustomStrategy);
  addDynamicRoute("POST", "/api/v1/custom-strategies/:id/validate", handleValidateCustomStrategy);
}
