# Strategy Architecture

End-to-end reference for the strategy + backtest feature. Covers server modules, client UI, data flow, and persistence.

---

## 1. Overview

A **Strategy** is a class that receives candles one at a time and optionally emits a `Signal` (`BUY`/`SELL`). The `runBacktest` engine replays historical candles through a strategy and routes signals through an `Executor` (backtest/paper/live). Trades, orders, and equity curve are persisted and returned to the client for rendering.

```mermaid
flowchart LR
    subgraph Client
        UI[BacktestPage + RunConfigForm]
        Hooks[TanStack Query hooks]
        Chart[EquityChart + Trades table]
    end

    subgraph Server_API[Server / api]
        RunEP[POST /api/v1/backtest/run]
        HistEP[GET /api/v1/backtest/history]
        StratEP[GET /api/v1/strategies]
    end

    subgraph Engine[modules/backtest/engine.ts]
        Loop[Candle loop]
        Risk[Risk checks]
        Exec[Executor]
    end

    subgraph Strategy[modules/strategy]
        Base[Strategy base class]
        Concrete[SMA / RSI+MACD / Boll+Vol]
        Reg[Registry]
    end

    subgraph Ind[modules/indicators]
        SMA & EMA & RSI & MACD & BB
    end

    subgraph DB[(SQLite)]
        Candles[(candles)]
        BTRuns[(backtest_runs)]
        SRuns[(strategy_runs)]
        Orders[(orders)]
    end

    UI --> Hooks --> RunEP
    UI --> Hooks --> StratEP
    UI --> Hooks --> HistEP

    RunEP --> Engine
    Engine --> Candles
    Engine --> Reg --> Concrete --> Ind
    Concrete -- Signal --> Loop
    Loop --> Risk --> Exec
    Exec --> Orders
    Engine --> BTRuns
    Engine --> SRuns

    RunEP -- BacktestResult --> Hooks --> Chart
    HistEP --> DB
```

---

## 2. Server Architecture

### 2.1 `modules/strategy/`

| File | Role |
|------|------|
| `base-strategy.ts` | Abstract `Strategy` class — `name`, `description`, `paramSpecs[]`, `supportedIntervals/Modes`, `onCandle(candle, ctx)`, `onStart/onStop` |
| `types.ts` | `Signal`, `Position`, `StrategyContext` |
| `registry.ts` | `registerStrategy()`, `getStrategy(name)`, `listStrategies()`. Auto-registers 3 built-ins |
| `sma-crossover.ts` | Golden/death cross on SMA fast vs slow (defaults 10 / 50) |
| `rsi-macd.ts` | RSI oversold + MACD histogram zero-cross positive → BUY; opposite → SELL |
| `bollinger-volume.ts` | Price at lower band + volume spike → BUY; upper band → SELL |
| `index.ts` | Public exports |

`Signal` shape:

```typescript
{ action: 'BUY' | 'SELL'; quantity: number; price: number; reason: string }
```

`StrategyContext` shape (built fresh per candle in engine):

```typescript
{ position, candles: window[], params, mode, balance, initialBalance, riskLimits }
```

### 2.2 `modules/indicators/`

Pure functions over number arrays. One file per indicator:

- `sma.ts` → `sma(values, period): number[]`
- `ema.ts` → `ema(values, period): number[]`
- `rsi.ts` → `rsi(values, period): number[]`
- `macd.ts` → `macd(closes, fast, slow, signal): MacdResult[]`
- `bollinger.ts` → `bollingerBands(closes, period, stdDev): BollingerResult[]`

Strategies call these on `ctx.candles` slice.

### 2.3 `modules/backtest/engine.ts`

Entry: `runBacktest(config, db?)` at `engine.ts:108`.

Steps:
1. Load candles via `queryCandlesAggregated(...)` — `engine.ts:113`
2. Instantiate strategy via `getStrategy(name)` — `engine.ts:121`
3. Create `strategy_runs` row (if persisted) — `engine.ts:122`
4. Init balance, position=null, `BacktestExecutor`, risk state — `engine.ts:135–141`
5. Loop candles (`engine.ts:144`):
   - Cap window to last 200 candles — `engine.ts:147–148`
   - Build `StrategyContext` — `engine.ts:150–158`
   - Reset per-minute order counter — `engine.ts:160–164`
   - Call `strategy.onCandle(candle, ctx)` — `engine.ts:166`
   - If signal: validate executable (`getExecutableSignal`), runtime risk, pre-trade risk, then `executor.execute(...)` — `engine.ts:168–207`
   - Update balance + position + trades + equity curve — `engine.ts:209–225`
6. Persist `backtest_runs` + `orders`, return `BacktestResult`

### 2.4 `modules/execution/`

| File | Role |
|------|------|
| `types.ts` | `Executor` interface: `execute(signal, context): Fill` |
| `backtest-executor.ts` | Applies `slippagePct`, returns `Fill` (price/qty/timestamp/fees) |
| `paper-executor.ts` | 0.1% simulated slippage |
| `mode-router.ts` | `getExecutorForMode('backtest' | 'paper' | 'live')` |
| `db.ts` | `strategy_runs`, `orders` schema + CRUD |

### 2.5 HTTP routes (`server/api/`)

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/v1/backtest/run` | `handleRunBacktest` (`backtest.ts:10`) |
| GET | `/api/v1/backtest/history` | `handleGetBacktestHistory` (`backtest.ts:43`) |
| GET | `/api/v1/backtest/history/:id` | `handleGetBacktestRun` (`backtest.ts:49`) |
| GET | `/api/v1/strategies` | `handleListStrategies` (`index.ts:187`) |
| GET/POST | `/api/v1/market-data/instruments` | market-data routes |

OAuth stays at root (`/auth/callback`), not under `/api/v1/`.

---

## 3. Client Architecture

### 3.1 Route

`/backtest` → `BacktestPage.tsx:315` — houses `RunConfigForm` + `ResultsPanel` + `HistoryPanel`.

Sidebar entries (`AppShell.tsx:110–127`): "Strategies" (LineChart icon) and "Backtest" (FlaskConical icon), both → `/backtest`.

### 3.2 API layer (`client/lib/api.ts`)

| Function | Endpoint |
|----------|----------|
| `runBacktest()` `:416` | `POST /api/v1/backtest/run` |
| `getBacktestHistory()` `:430` | `GET /api/v1/backtest/history` |
| `getBacktestResult(id)` `:437` | `GET /api/v1/backtest/history/:id` |
| `getStrategies()` `:444` | `GET /api/v1/strategies` |
| `getTrackedInstruments()` `:232` | `GET /api/v1/market-data/instruments` |
| `getCandles()` `:277` | `GET /api/v1/market-data/instruments/:id/candles` |

### 3.3 TanStack Query hooks (`backtest-queries.ts`)

- `useStrategiesQuery()` `:17` — 60min staleTime
- `useRunBacktestMutation()` `:25` — invalidates history on success
- `useBacktestHistoryQuery()` `:35`
- `useBacktestResultQuery(id)` `:42`
- `useTrackedInstrumentsQuery()` (`market-data-queries.ts:19`) — 5s refetch

### 3.4 `RunConfigForm.tsx` inputs

Lines `:207–720`:

- Mode selector (backtest/paper/live)
- Strategy dropdown — auto-loads `defaultParams` from spec
- Instrument dropdown (tracked instruments)
- Date range `from/to` (default = 1yr window)
- Initial balance (default ₹100k)
- Candle interval (1d / 1h / 1m)
- Dynamic params section — renders number/integer/select inputs per `paramSpecs`
- Risk limits (collapsible): `maxDailyLossPct`, `maxOpenPositions`, `maxCapitalPerTradePct`, `maxStrategyDrawdownPct`, `maxOrdersPerMinute`, `killSwitchEnabled`
- F&O contract section (if instrument is FUT/CE/PE): underlying, type, expiryPolicy, strikeSelection, lotMultiplier

### 3.5 Rendering

- `EquityChart` `:17` — lightweight-charts LineSeries, dedup by day
- `MetricCard` `:65` — label + value
- `ResultsPanel` `:88` — metrics grid (Total PnL, Win Rate, Max Drawdown, Trades, Avg Profit), equity chart, trades table
- Trades table `:139` — Time | Action badge | Price | Qty | Reason | Balance After
- `HistoryPanel` `:195` — past runs, click to reload

---

## 4. Sequence: one backtest run

```mermaid
sequenceDiagram
    participant U as User
    participant F as RunConfigForm
    participant Q as useRunBacktestMutation
    participant A as POST /api/v1/backtest/run
    participant E as runBacktest (engine)
    participant MD as candles DB
    participant S as Strategy.onCandle
    participant X as BacktestExecutor
    participant DB as backtest_runs / orders
    participant R as ResultsPanel

    U->>F: fill config + click Run
    F->>Q: mutate(config)
    Q->>A: POST BacktestConfig
    A->>E: runBacktest(config)
    E->>MD: queryCandlesAggregated(key, from, to, interval)
    MD-->>E: Candle[]
    E->>E: getStrategy(name); onStart(params)
    loop each candle
        E->>S: onCandle(candle, ctx)
        S-->>E: Signal | null
        alt signal present
            E->>E: executable? + risk checks
            E->>X: execute(signal, ctx)
            X-->>E: Fill
            E->>E: update balance/position/trades
        end
    end
    E->>DB: insert backtest_runs + orders
    E-->>A: BacktestResult
    A-->>Q: JSON
    Q-->>R: render metrics + equity + trades
```

---

## 5. Signal → Order flow

```mermaid
flowchart TD
    S[Signal from onCandle] --> Exec{getExecutableSignal?\nbalance / position check}
    Exec -- no --> Drop[drop]
    Exec -- yes --> RT{checkRuntimeRisk\n(orders/min, kill switch)}
    RT -- reject --> Rej1[log risk event + orders row status=rejected]
    RT -- allow --> PT{checkPreTrade\n(daily loss, drawdown, capital, open positions)}
    PT -- reject --> Rej1
    PT -- allow --> Ex[executor.execute -> Fill]
    Ex --> U{action?}
    U -- BUY --> B[balance -= qty*price + fees\nposition = new Position]
    U -- SELL --> Se[balance += proceeds - fees\nposition = null]
    B --> Rec[push Trade + orders row status=filled]
    Se --> Rec
```

---

## 6. DB schema

### `candles` (`market-data/db.ts:10`)
`instrument_key, timestamp, open, high, low, close, volume, oi` — indexed on `(instrument_key, timestamp)`.

### `tracked_instruments`
`instrument_key, name, exchange, status, earliest_fetched, latest_fetched`.

### `instruments`
Cached Upstox metadata (`raw_data` JSON).

### `backtest_runs` (`backtest/db.ts:6`)
`id, strategy_name, instrument_key, config (JSON), result (JSON), total_pnl, win_rate, total_trades, created_at`.

### `strategy_runs` (`execution/db.ts:54`)
`id, strategy_name, instrument_key, mode, config, status, started_at, stopped_at, error_message` (16 cols).

### `orders` (`execution/db.ts`)
`id, strategy_run_id, instrument_key, action, quantity, requested_price, filled_price, slippage, fees, status, mode, upstox_order_id, reject_reason, created_at, filled_at`.

---

## 7. Backtest vs Paper vs Live

| Aspect | Backtest | Paper | Live |
|--------|----------|-------|------|
| Candle source | `candles` table (historical) | market-data WebSocket | market-data WebSocket |
| Executor | `BacktestExecutor` (config slippage) | `PaperExecutor` (0.1%) | `LiveExecutor` (Upstox API, stub) |
| Loop driver | `for i in candles` | WebSocket tick → StrategyRunner | WebSocket tick → StrategyRunner |
| Persistence | `backtest_runs` + `orders` | `strategy_runs` + `orders` | `strategy_runs` + `orders` |
| Balance | `config.initialBalance` | `config.initialBalance` | Upstox portfolio |
| Risk checks | same `checkRuntimeRisk` + `checkPreTrade` | same | same |

Mode selected via `getExecutorForMode(mode)` (`execution/mode-router.ts:10`).

---

## 8. Module wiring (`server/index.ts`)

Startup order:
1. Market-data DB schema auto-initializes on import.
2. Execution DB schema auto-initializes on import.
3. Strategy registry auto-registers 3 built-ins (`registry.ts:46–48`).
4. Backtest DB schema auto-initializes.
5. `startDownloadWorker()` — `index.ts:64` — continuous candle fetch.
6. Route registration: `registerHistoricalRoutes`, `registerMarketDataRoutes`, `registerBacktestRoutes` (`index.ts:65–77`).
7. Bun.serve routes defined `:80–195`; fallback `matchRoute()` for dynamic paths `:196–200`.

---

## 9. Extending

To add a strategy:
1. Create `server/modules/strategy/my-strat.ts` extending `Strategy`.
2. Implement `onCandle`, declare `paramSpecs`, `supportedIntervals`, `supportedModes`.
3. Register in `registry.ts` bottom.
4. Client picks it up automatically via `GET /api/v1/strategies`.

To add an indicator:
1. Add `server/modules/indicators/my-ind.ts` + test.
2. Re-export in `indicators/index.ts`.
3. Import from strategies.
