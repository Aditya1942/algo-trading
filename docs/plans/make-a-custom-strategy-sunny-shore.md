# Custom Strategy Builder + Backtest Runner

## Context

Today only three built-in strategies exist (SMA crossover, RSI+MACD, Bollinger+Volume), registered as compiled TS classes at server startup (`server/modules/strategy/registry.ts`). To experiment, a user must edit server code and restart. Goal: let user author strategies in a browser code editor, persist them, and run backtests on stored candles (`server/modules/market-data/db.ts` candles table) using the existing backtest engine — results flowing into `backtest_runs` (`server/modules/backtest/db.ts`). Full parameter + context access, safe isolation so bad user code can't crash the server.

## Decisions (from clarification)

- **Sandbox:** Bun `Worker` per run. Timeout per `onCandle` call.
- **Shape:** full `Strategy` class — user writes class extending base, keeps framework symmetry with built-ins.
- **Persistence:** new `custom_strategies` SQLite table.
- **Runtime ctx:** full context (indicators, 200-candle window, `ctx.log`, `ctx.state`) + minimal fields (candle, position, balance) already present on built-in `StrategyContext`.

## Architecture

```
client/StrategyBuilderPage (Monaco)
  └─► POST /api/v1/custom-strategies          (CRUD)
client/RunConfigForm (strategy dropdown merges built-ins + custom)
  └─► POST /api/v1/backtest/run  { strategyName: "custom:<id>", ... }
       └─► backtest/engine.ts
             ├─ built-in path: getStrategy(name)               (existing)
             └─ custom path:   CustomStrategyProxy (new)
                   └─ spawns Bun Worker
                         └─ loads user class via `new Function`
                         └─ onCandle(candle, wireCtx) → Signal|null
```

## Server Changes

### 1. New table + DAL
**File:** `server/modules/strategy/custom-db.ts` (new)

```sql
CREATE TABLE custom_strategies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  description    TEXT NOT NULL DEFAULT '',
  code           TEXT NOT NULL,                -- TS source of class
  param_specs    TEXT NOT NULL DEFAULT '[]',   -- JSON StrategyParamSpec[]
  supported_intervals TEXT NOT NULL DEFAULT '["1d","1h","1m"]',
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Exports: `createCustom`, `updateCustom`, `deleteCustom`, `getCustom(id)`, `listCustom()`. Uses `bun:sqlite` singleton pattern matching existing module.

### 2. Sandbox worker
**File:** `server/modules/strategy/custom-worker.ts` (new, Worker entry)

Receives messages over `self.postMessage` / `self.onmessage`:
- `{type:"init", code, params}` → strips imports, wraps user source with bundled indicators module, `new Function("Strategy", "indicators", userCode)(Strategy, indicators)` to return the class constructor, instantiates, calls `onStart(params)`. Replies `{type:"ready"}` or `{type:"error"}`.
- `{type:"candle", candle, windowTail, position, balance, state}` → builds `ctx` (wire-friendly subset), calls `onCandle`, replies `{type:"signal", signal, logs, state}`.
- `{type:"stop"}` → calls `onStop`, terminates.

**Injected `Strategy` base stub** uses same `StrategyParamSpec`, `Signal` types from `server/shared/contracts/strategy-params.ts` (re-export into worker). **Indicators** re-exported from `server/modules/indicators/index.ts`.

**Safety:** worker has no filesystem / network globals imported. Per-message timeout 100ms (configurable) — if exceeded, parent terminates worker and marks run failed.

### 3. Strategy proxy
**File:** `server/modules/strategy/custom-proxy.ts` (new)

`CustomStrategyProxy extends Strategy`:
- constructor takes the DB row (name, code, param_specs).
- `onStart(params)` → `new Worker(import.meta.resolve("./custom-worker.ts"))`, send `init`, await `ready`.
- `onCandle(candle, ctx)` → synchronously blocks on worker round-trip via `Atomics.wait` on a `SharedArrayBuffer`, **OR** we change engine to `await` signals (see §4).
- `onStop()` → send `stop`, terminate.

### 4. Engine integration
**File edit:** `server/modules/backtest/engine.ts`

- Resolve strategy: if `config.strategyName.startsWith("custom:")`, load row from `custom-db`, instantiate `CustomStrategyProxy`; else existing `getStrategy(name)`.
- Make the candle loop **async** around `onCandle` (current built-ins are sync — their proxies will still return sync; we just `await` uniformly). Built-in `Strategy.onCandle` signature stays `Signal | null`; proxy returns `Promise<Signal | null>`. Widen `Strategy.onCandle` return to `Signal | null | Promise<Signal | null>` in `base-strategy.ts`.

### 5. Validation
`validateRunConfig` (existing in `server/api/backtest.ts`) already allows arbitrary strategy names through registry lookup. Extend: accept `custom:<id>` format, verify row exists, verify user-supplied `params` keys match stored `param_specs`.

### 6. HTTP routes
**File:** `server/api/custom-strategies.ts` (new), wired in `server/index.ts` router.

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/custom-strategies` | list |
| GET | `/api/v1/custom-strategies/:id` | get one |
| POST | `/api/v1/custom-strategies` | create (body: name, description, code, param_specs, supported_intervals) |
| PUT | `/api/v1/custom-strategies/:id` | update |
| DELETE | `/api/v1/custom-strategies/:id` | delete |
| POST | `/api/v1/custom-strategies/:id/validate` | spin up worker, run init + one synthetic candle, return `{ok, error?}` |

Also extend `GET /api/v1/strategies` response to merge custom rows (marked `kind: "custom"`, name prefixed `custom:<id>`) so client dropdown just works.

## Client Changes

### 7. Dependencies
`cd client && bun add @monaco-editor/react monaco-editor`.

### 8. New page
**File:** `client/src/pages/StrategyBuilderPage.tsx` (new)

Layout: left sidebar list of saved strategies + "New"; right pane split vertically — top form (name, description, paramSpecs JSON via dynamic rows, supported intervals checkboxes), middle Monaco editor preloaded with a TS starter template and type definitions (from `/api/v1/custom-strategies/types.d.ts` served as string — or statically bundled string constant). Buttons: `Save`, `Validate`, `Run Backtest`. `Run Backtest` navigates to `/backtest?strategyName=custom:<id>` and `RunConfigForm` preselects it.

Starter template:

```ts
export default class MyStrategy extends Strategy {
  name = "my-strat"
  description = "..."
  paramSpecs = [{ key: "period", label: "Period", type: "integer", defaultValue: 14 }]

  onStart(params) { this.period = params.period }
  onCandle(candle, ctx) {
    const closes = ctx.window.map(c => c.close)
    const sma = ctx.indicators.sma(closes, this.period)
    if (candle.close > sma.at(-1)) return { action: "BUY", quantity: 1 }
    return null
  }
  onStop() {}
}
```

### 9. API client + hooks
**Files:** extend `client/src/lib/api.ts` with `listCustomStrategies`, `getCustomStrategy`, `saveCustomStrategy`, `deleteCustomStrategy`, `validateCustomStrategy`. New `client/src/lib/custom-strategy-queries.ts` mirroring `backtest-queries.ts` pattern.

### 10. RunConfigForm
**File edit:** `client/src/components/RunConfigForm.tsx`

- Strategy dropdown now merges built-ins + custom (sourced from extended `/api/v1/strategies`).
- Read `strategyName` query-string param on mount for auto-preselect.
- `paramSpecs` rendering unchanged — already generic.

### 11. Routing + nav
**Edits:** `client/src/App.tsx` add `/strategy-builder` route under `RequireAuth`. `client/src/components/layout/AppShell.tsx` add sidebar item (use `Code2` lucide icon).

## Files Modified / Created

**New:** `server/modules/strategy/custom-db.ts`, `custom-worker.ts`, `custom-proxy.ts`, `server/api/custom-strategies.ts`, `client/src/pages/StrategyBuilderPage.tsx`, `client/src/lib/custom-strategy-queries.ts`.

**Edited:** `server/modules/strategy/base-strategy.ts` (widen `onCandle` return), `server/modules/strategy/registry.ts` (helper `isCustomName`), `server/modules/backtest/engine.ts` (async onCandle + custom routing), `server/api/backtest.ts` (accept custom name), `server/api/strategies.ts` (merge list), `server/index.ts` (route wiring), `client/src/lib/api.ts`, `client/src/components/RunConfigForm.tsx`, `client/src/App.tsx`, `client/src/components/layout/AppShell.tsx`, `client/package.json`.

## Verification

1. `bun test` in `server/` — existing strategy + backtest tests must still pass (engine async change is the main risk).
2. New unit test `server/modules/strategy/custom-proxy.test.ts`: feed a trivial user class, feed synthetic candles, assert signals returned.
3. Manual end-to-end: `bun run dev` → browser `/strategy-builder` → author SMA-crossover clone → save → run backtest on an already-tracked instrument with known date range → compare PnL/trade count with built-in `sma-crossover` run (should match within tolerance).
4. Safety: submit a user strategy with `while(true){}` in `onCandle` → run must abort with timeout error, server stays responsive.
5. Bad params: submit `params` missing required key → validation rejects with 400.
