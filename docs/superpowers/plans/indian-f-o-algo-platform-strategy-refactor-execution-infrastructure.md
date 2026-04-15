# Indian F&O Algo Platform — Strategy Refactor & Execution Infrastructure

## Context

Current strategy system works for basic backtesting but has weak typing (`Record<string, number>` everywhere), no risk controls, no execution modes beyond backtest, and no F&O support. The goal is to upgrade to a production-lean architecture supporting `backtest + paper + live` with typed parameter contracts, risk engine, and operator-friendly UI — modeled after QuantConnect, Freqtrade, Hummingbot, and Alpaca patterns.

**Current state (verified from code):**
- `Strategy` abstract class: `onCandle(candle, ctx) → Signal | null`, `onStart(params)`, `onStop()`
- `StrategyContext`: `{ position, candles, params: Record<string, number> }`
- `Signal`: `{ action: BUY|SELL, quantity, price, reason }` — quantity is always `1` for BUY (engine overrides with max-buyable)
- `BacktestConfig`: `{ strategyName, instrumentKey, from, to, interval, initialBalance, params: Record<string, number> }`
- Registry: `Map<string, constructor>`, returns `{ name, description, defaultParams }`
- Backtest engine: 112-line tight loop, fills at close, 200-candle window, no slippage/fees/risk
- API handler: zero validation — raw JSON body passed directly to `runBacktest()`
- **Missing entirely:** orders module, portfolio module, risk module, execution module, F&O resolver

---

## Phase 1 — Contracts & Validation

**Goal:** Define all shared types with runtime validation. Foundation for everything else.

### Files to create
- `server/shared/contracts/strategy-params.ts`
- `server/shared/contracts/risk-limits.ts`
- `server/shared/contracts/run-config.ts`
- `server/shared/contracts/fo-contract.ts`
- `server/shared/contracts/index.ts`
- `server/shared/contracts/__tests__/validation.test.ts`

### Key interfaces

```typescript
// strategy-params.ts
export interface StrategyParamSpec {
  key: string
  label: string
  type: 'number' | 'integer' | 'select'
  required: boolean
  defaultValue: number
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: number }[]
  description?: string
  group?: string  // UI grouping: "SMA", "RSI", "Risk"
}

// risk-limits.ts
export interface RiskLimits {
  maxDailyLossPct: number
  maxOpenPositions: number
  maxCapitalPerTradePct: number
  maxStrategyDrawdownPct: number
  maxOrdersPerMinute: number
  killSwitchEnabled: boolean
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLossPct: 3,
  maxOpenPositions: 5,
  maxCapitalPerTradePct: 20,
  maxStrategyDrawdownPct: 15,
  maxOrdersPerMinute: 10,
  killSwitchEnabled: true,
}

// fo-contract.ts
export interface FoContractConfig {
  underlying: string
  instrumentType: 'FUT' | 'CE' | 'PE'
  expiryPolicy: 'current_month' | 'next_month' | 'current_week' | 'next_week'
  strikeSelection?: 'atm' | 'otm_1' | 'otm_2' | 'itm_1' | 'itm_2'
  lotMultiplier: number
}

// run-config.ts
export interface StrategyRunConfig {
  mode: 'backtest' | 'paper' | 'live'
  strategyName: string
  instrumentKey: string
  interval: '1d' | '1h' | '1m'
  from?: string        // backtest only
  to?: string          // backtest only
  initialBalance: number
  params: Record<string, number>
  risk: RiskLimits
  fo?: FoContractConfig  // optional, F&O only
}
```

### Validation
Each contract file exports `validateX()` → `{ ok: true, value: T } | { ok: false, errors: string[] }`. No external libs. Simple field checks.

`validateRunConfig()` normalizes legacy `BacktestConfig` shape: if `mode` missing → `'backtest'`; if `risk` missing → `DEFAULT_RISK_LIMITS`.

### Migration path
- `BacktestConfig` in `server/modules/backtest/types.ts` becomes type alias: `type BacktestConfig = Omit<StrategyRunConfig, 'fo'> & { mode: 'backtest' }`
- API handler `handleRunBacktest` gains validation before passing to engine
- Client types in `client/src/lib/api.ts` get mirrored copies (not imports — different compilation units)

### Files to modify
- `server/modules/backtest/types.ts` — import `StrategyRunConfig`, alias `BacktestConfig`
- `server/api/backtest.ts` — add validation in `handleRunBacktest`
- `client/src/lib/api.ts` — mirror `StrategyParamSpec`, `RiskLimits`, `StrategyRunConfig` types

### Backward compat
`POST /api/v1/backtest/run` continues accepting old `BacktestConfig` shape. Handler normalizes internally.

### Tests
Unit tests for each `validate*` with valid/invalid inputs.

---

## Phase 2 — Strategy Metadata & Registry Upgrade

**Goal:** Each strategy declares typed `paramSpecs` instead of bare `Record<string, number>`. Registry returns rich metadata for UI-driven form rendering.

### Changes to base class (`server/modules/strategy/base-strategy.ts`)

```typescript
import type { StrategyParamSpec } from '../../shared/contracts'

export abstract class Strategy {
  abstract name: string
  abstract description: string
  abstract paramSpecs: StrategyParamSpec[]  // NEW — replaces abstract defaultParams

  // Computed getter for backward compat
  get defaultParams(): Record<string, number> {
    return Object.fromEntries(this.paramSpecs.map(s => [s.key, s.defaultValue]))
  }

  // Optional metadata
  supportedIntervals?: ('1d' | '1h' | '1m')[]
  supportedModes?: ('backtest' | 'paper' | 'live')[]

  abstract onCandle(candle: CandleRow, ctx: StrategyContext): Signal | null
  abstract onStart(params: Record<string, number>): void
  abstract onStop(): void
}
```

### Strategy migrations

**sma-crossover.ts** — replace `defaultParams = { fastPeriod: 10, slowPeriod: 50 }` with:
```typescript
paramSpecs: StrategyParamSpec[] = [
  { key: 'fastPeriod', label: 'Fast Period', type: 'integer', required: true, defaultValue: 10, min: 2, max: 200, step: 1, group: 'SMA' },
  { key: 'slowPeriod', label: 'Slow Period', type: 'integer', required: true, defaultValue: 50, min: 5, max: 500, step: 1, group: 'SMA' },
]
```

**rsi-macd.ts** — 6 param specs (rsiPeriod, rsiBuy, rsiSell, macdFast, macdSlow, macdSignal) with appropriate min/max/groups.

**bollinger-volume.ts** — 3 param specs (bbPeriod, bbStdDev, volumeMultiplier).

### Registry changes (`server/modules/strategy/registry.ts`)

`listStrategies()` return type adds `paramSpecs`:
```typescript
{ name, description, defaultParams, paramSpecs, supportedIntervals?, supportedModes? }[]
```

### API change
`GET /api/v1/strategies` response includes `paramSpecs`. Old clients that only read `defaultParams` unaffected.

### Client mirror
`StrategyInfo` in `client/src/lib/api.ts` gains `paramSpecs?: StrategyParamSpec[]` (optional for rollout safety).

### Files to modify
- `server/modules/strategy/base-strategy.ts`
- `server/modules/strategy/strategies/sma-crossover.ts`
- `server/modules/strategy/strategies/rsi-macd.ts`
- `server/modules/strategy/strategies/bollinger-volume.ts`
- `server/modules/strategy/registry.ts`
- `server/modules/strategy/index.ts` — re-export `StrategyParamSpec`
- `server/api/backtest.ts` — `handleListStrategies` returns expanded metadata
- `client/src/lib/api.ts` — update `StrategyInfo`

### Tests
Update `registry.test.ts` — verify `paramSpecs` returned, `defaultParams` getter matches old values. Update strategy tests to check `paramSpecs` content.

---

## Phase 3a — Risk Engine (parallel with 3b)

**Goal:** Pre-trade and runtime risk checks with structured reject codes.

### Files to create
- `server/modules/risk/types.ts`
- `server/modules/risk/pre-trade.ts`
- `server/modules/risk/runtime.ts`
- `server/modules/risk/index.ts`
- `server/modules/risk/__tests__/pre-trade.test.ts`
- `server/modules/risk/__tests__/runtime.test.ts`

### Key types
```typescript
type RiskRejectCode =
  | 'DAILY_LOSS_EXCEEDED'
  | 'MAX_POSITIONS_EXCEEDED'
  | 'CAPITAL_PER_TRADE_EXCEEDED'
  | 'DRAWDOWN_EXCEEDED'
  | 'ORDER_RATE_EXCEEDED'
  | 'KILL_SWITCH_ACTIVE'

interface RiskCheckResult {
  allowed: boolean
  rejectCode?: RiskRejectCode
  rejectReason?: string
  adjustedQuantity?: number  // risk may cap quantity
}

interface RiskState {
  dailyPnl: number
  openPositionCount: number
  currentCapital: number
  initialCapital: number
  peakCapital: number
  ordersThisMinute: number
  killSwitchTripped: boolean
}
```

### Core function
```typescript
function checkPreTrade(signal: Signal, limits: RiskLimits, state: RiskState): RiskCheckResult
```

Pure-function module. No DB tables (persistence = Phase 6). Execution layer calls `checkPreTrade()` before every order.

### Tests
Unit tests with various RiskState + RiskLimits combos. Test each reject code path + adjustedQuantity.

---

## Phase 3b — F&O Contract Resolver (parallel with 3a)

**Goal:** Resolve underlying + policy → specific F&O contract. **MVP: types + validation only, resolver as stub.**

### Files to create
- `server/modules/fo-resolver/types.ts`
- `server/modules/fo-resolver/resolver.ts`
- `server/modules/fo-resolver/index.ts`
- `server/modules/fo-resolver/__tests__/resolver.test.ts`

### Resolver (stub for now)
```typescript
async function resolveContract(
  config: FoContractConfig,
  referencePrice: number,
  referenceDate: Date,
): Promise<{ instrumentKey: string; lotSize: number; expiry: string }>
// Throws "F&O resolution not yet implemented" — types matter now for UI, resolver comes later
```

Uses existing Upstox APIs (`/option/chain`, `instruments` table) when fully implemented.

---

## Phase 4 — Execution Layer

**Goal:** Mode router (backtest/paper/live), refactor backtest engine to use executor pattern, paper engine with slippage.

### Files to create
- `server/modules/execution/types.ts`
- `server/modules/execution/executor.ts` — `Executor` interface
- `server/modules/execution/backtest-executor.ts`
- `server/modules/execution/paper-executor.ts`
- `server/modules/execution/live-executor.ts` (stub)
- `server/modules/execution/mode-router.ts`
- `server/modules/execution/index.ts`
- `server/modules/execution/__tests__/backtest-executor.test.ts`
- `server/modules/execution/__tests__/paper-executor.test.ts`

### Executor interface
```typescript
interface Executor {
  execute(signal: Signal, context: ExecutionContext): Fill | Promise<Fill>
}

interface Fill {
  price: number
  quantity: number
  timestamp: string
  slippage: number
  fees: number
  orderId?: string
}

interface ExecutionContext {
  candle: CandleRow
  balance: number
  position: Position | null
  riskCheckResult: RiskCheckResult
}
```

### Backtest engine refactor (`server/modules/backtest/engine.ts`)

Current engine (lines 39-69) handles signal interpretation AND fills in one loop. Refactor:

```typescript
// Pseudocode of refactored loop
for (const candle of candles) {
  const signal = strategy.onCandle(candle, ctx)
  if (signal) {
    const riskCheck = checkPreTrade(signal, config.risk, riskState)
    if (riskCheck.allowed) {
      const fill = backtestExecutor.execute(signal, { candle, balance, position, riskCheckResult: riskCheck })
      // update position, balance, trades from fill
      updateRiskState(riskState, fill)
    }
  }
}
```

### StrategyContext expansion (`server/modules/strategy/types.ts`)
```typescript
export interface StrategyContext {
  position: Position | null
  candles: CandleRow[]
  params: Record<string, number>
  // NEW — informational, optional for existing strategies:
  mode?: 'backtest' | 'paper' | 'live'
  balance?: number
  initialBalance?: number
  riskLimits?: RiskLimits
}
```

New fields optional — existing strategies continue working unchanged.

### Slippage model
Backtest executor: fill at `close * (1 + slippagePct)` for BUY, `close * (1 - slippagePct)` for SELL. Default `slippagePct = 0` preserves current behavior.

### BacktestConfig extension
`server/modules/backtest/types.ts` gains optional fields: `slippagePct?: number`, `risk?: RiskLimits`.

### Critical: backward compat
Refactored engine MUST produce identical results when `risk` not provided and `slippagePct` is 0. Verified by running existing `engine.test.ts` tests unchanged.

### Files to modify
- `server/modules/strategy/types.ts` — expand StrategyContext
- `server/modules/backtest/engine.ts` — refactor to use executor + risk
- `server/modules/backtest/types.ts` — add optional slippagePct, risk

---

## Phase 5 — UI Configuration

**Goal:** Dynamic `RunConfigForm` component with mode/risk/F&O sections.

### Files to create
- `client/src/components/RunConfigForm.tsx`

### Files to modify
- `client/src/lib/api.ts` — add `StrategyParamSpec`, `RiskLimits`, `StrategyRunConfig` types (client mirrors)
- `client/src/lib/backtest-queries.ts` — `useStrategiesQuery` returns `paramSpecs`
- `client/src/pages/BacktestPage.tsx` — extract ConfigForm (lines 294-543) into `RunConfigForm`, import back

### Form sections
1. **Mode selector** — backtest (default) / paper / live toggle
2. **Strategy + Instrument** — existing dropdowns, unchanged
3. **Date range + interval + balance** — existing, show only for backtest mode
4. **Strategy params** — UPGRADED: renders from `paramSpecs` with proper labels, min/max/step, group headers, descriptions. Falls back to raw `Record<string, number>` rendering if `paramSpecs` undefined
5. **Risk limits** — collapsible section, defaults from `DEFAULT_RISK_LIMITS`
6. **F&O config** — collapsible, shown only when instrument is F&O-eligible

### Backward compat
`ResultsPanel` and `HistoryPanel` untouched. Page structure stays same.

---

## Phase 6 — Persistence & Observability

**Goal:** DB tables for strategy runs, orders, risk events.

### Files to create
- `server/modules/execution/db.ts`
- `server/modules/risk/db.ts`
- `server/modules/execution/__tests__/db.test.ts`

### New tables

```sql
CREATE TABLE IF NOT EXISTS strategy_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_name   TEXT NOT NULL,
  instrument_key  TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('backtest','paper','live')),
  config          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  started_at      TEXT DEFAULT (datetime('now')),
  stopped_at      TEXT,
  error_message   TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_run_id INTEGER REFERENCES strategy_runs(id),
  instrument_key  TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('BUY','SELL')),
  quantity        INTEGER NOT NULL,
  requested_price REAL,
  filled_price    REAL,
  slippage        REAL DEFAULT 0,
  fees            REAL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  mode            TEXT NOT NULL,
  upstox_order_id TEXT,
  reject_reason   TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  filled_at       TEXT
);

CREATE TABLE IF NOT EXISTS risk_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_run_id INTEGER REFERENCES strategy_runs(id),
  reject_code     TEXT NOT NULL,
  reject_reason   TEXT,
  signal_action   TEXT,
  signal_quantity  INTEGER,
  risk_state      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
```

Existing `backtest_runs` table untouched for backward compat. New runs also create `strategy_runs` row.

---

## Phase 7 — Tests & Verification

**Goal:** Full regression + new integration tests.

### Test files to create
- `server/shared/contracts/__tests__/validation.test.ts`
- `server/modules/risk/__tests__/pre-trade.test.ts`
- `server/modules/risk/__tests__/runtime.test.ts`
- `server/modules/execution/__tests__/backtest-executor.test.ts`
- `server/modules/execution/__tests__/paper-executor.test.ts`
- `server/modules/execution/__tests__/integration.test.ts`

### Verification checklist
- [ ] `bun test` from `server/` — all existing tests pass (regression baseline)
- [ ] Contract validation rejects invalid configs with actionable errors
- [ ] `GET /api/v1/strategies` returns `paramSpecs` + `defaultParams` (backward compat)
- [ ] Backtest with no risk/slippage produces identical results to current engine
- [ ] Backtest with risk limits rejects over-limit trades
- [ ] Paper executor applies slippage correctly
- [ ] UI form renders param specs with labels/min/max
- [ ] Mode selector shows/hides appropriate form sections
- [ ] Risk events persisted to DB for rejected trades
- [ ] End-to-end: config → validate → execute → persist → query

---

## Dependency Graph

```
Phase 1 (Contracts) ← everything depends on this
  ↓
Phase 2 (Strategy Metadata) ← needs contracts types
  ↓
Phase 3a (Risk) + Phase 3b (F&O Resolver) ← parallel, need contracts
  ↓
Phase 4 (Execution Layer) ← needs risk + contracts + strategy metadata
  ↓
Phase 5 (UI) ← needs all server types settled
  ↓
Phase 6 (Persistence) ← needs execution types
  ↓
Phase 7 (Tests) ← ongoing, final verification pass
```

## Critical Files Reference

| File | Role |
|------|------|
| `server/modules/strategy/base-strategy.ts` | Abstract Strategy class — add `paramSpecs` |
| `server/modules/strategy/types.ts` | Signal, Position, StrategyContext — expand context |
| `server/modules/strategy/registry.ts` | Registry — return paramSpecs in listStrategies |
| `server/modules/strategy/strategies/*.ts` | 3 strategies — migrate to paramSpecs |
| `server/modules/backtest/engine.ts` | Backtest loop — refactor to use executor + risk |
| `server/modules/backtest/types.ts` | BacktestConfig — alias to StrategyRunConfig |
| `server/api/backtest.ts` | API handler — add validation |
| `client/src/lib/api.ts` | Client types — mirror contracts |
| `client/src/pages/BacktestPage.tsx` | Backtest UI — extract ConfigForm |

## Industry References
- QuantConnect LEAN: explicit param schemas, modular risk models
- Freqtrade: config-driven risk controls (stoploss, max_open_trades, dynamic stake)
- Hummingbot: strategy/controller + executor + connector + order tracking
- Alpaca: paper/live API parity, explicit simulation assumptions
- Zerodha/Kite: order/websocket rate limits → platform-level throttling
