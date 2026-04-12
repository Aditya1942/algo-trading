# Algo Trading Platform — Design Spec
_Date: 2026-04-12_

## Overview

Generic algorithmic trading platform using the Upstox API for both historical data (backtesting) and live order execution. Modular monolith built on Bun + TypeScript + SQLite. Separate frontend application connects via REST API.

**Scope:**
- NSE equity, NSE F&O, BSE instruments
- Paper trading and live trading via the same strategy interface
- Generic strategy framework — user writes strategy classes
- Backtesting against cached historical data
- Telegram alerts for trade events and PnL
- Local-first, designed to deploy on VPS later

---

## Architecture: Modular Monolith

```
server/
  modules/
    auth/           ← Upstox OAuth2 token lifecycle
    market-data/    ← historical OHLCV fetch + live WebSocket feed
    strategy/       ← Strategy base class, StrategyRunner, registry
    orders/         ← order placement, state machine, positions
    portfolio/      ← balance, PnL, holdings, trade history
    backtest/       ← historical replay engine, performance reports
    notifications/  ← Telegram bot alerts
  api/              ← thin HTTP route layer, wires modules together
  shared/
    db.ts           ← SQLite singleton (bun:sqlite)
    upstox.ts       ← Upstox HTTP + WebSocket client
    types.ts        ← Candle, Order, Position, Instrument, Signal
    config.ts       ← env vars
  index.ts          ← entry point, starts Bun server
```

Each module owns its own services and DB access. Modules communicate through typed function calls, never by reaching into another module's internals. No circular dependencies.

---

## Module Responsibilities

### `auth`
- Upstox OAuth2 flow — open browser once, capture redirect
- Store `access_token` + `refresh_token` in SQLite
- Auto-refresh token before expiry
- Expose `getToken()` used by shared Upstox client

### `market-data`
- Fetch historical OHLCV from Upstox API, cache in SQLite (`candles` table)
- Open WebSocket connection to Upstox live market feed
- Emit typed `Candle` events consumed by `StrategyRunner`
- Support multiple intervals: 1m, 5m, 15m, 1h, 1d

### `strategy`
- Abstract `Strategy` base class — user extends this
- `StrategyRunner` — feeds candles to strategy, handles paper vs live routing
- Strategy registry — register, start, stop named strategies
- `StrategyContext` — injected into each `onCandle` call

```typescript
abstract class Strategy {
  abstract name: string
  abstract onCandle(candle: Candle, ctx: StrategyContext): Signal | null
  abstract onStart(): void
  abstract onStop(): void
}

type Signal = {
  action: 'BUY' | 'SELL' | 'HOLD'
  quantity: number
  price?: number  // limit price; omit for market order
}

interface StrategyContext {
  instrument: Instrument
  portfolio: PortfolioSnapshot
  placeOrder: (signal: Signal) => Promise<Order>
}
```

`placeOrder` in context routes to paper engine or Upstox order API — strategy never knows the difference.

### `orders`
- Place orders via Upstox API (live) or simulate fill (paper)
- Order state machine: `PENDING → OPEN → FILLED | CANCELLED | REJECTED`
- Poll order status for live orders
- Track open positions per instrument per mode

### `portfolio`
- Current cash balance (paper and live tracked separately)
- Realized and unrealized PnL
- Holdings snapshot
- Trade history with timestamps

### `backtest`
- Fetch or load cached historical candles for date range
- Replay candles sequentially through `StrategyRunner` in paper mode
- Generate report: total PnL, win rate, max drawdown, Sharpe ratio, trade log
- Store results in `backtest_reports` table

### `notifications`
- Telegram bot via Bot API
- Send alerts: order filled, PnL milestone, strategy error, daily summary
- Log all sent notifications in `notification_log`

---

## Data Flow

### Live Trading
```
Upstox WebSocket
  → market-data: build candle on interval close
  → strategy: StrategyRunner.onCandle()
  → signal? → orders: place via Upstox API
  → portfolio: update positions + PnL
  → notifications: Telegram alert
```

### Backtesting
```
backtest: fetch OHLCV from Upstox API (or SQLite cache)
  → replay candles → StrategyRunner (paper mode)
  → orders: simulate fills
  → portfolio: track virtual PnL
  → backtest: generate performance report
```

### Frontend API
```
Frontend SPA
  ↕ HTTP REST (Bun server :3000)

GET  /portfolio              → balance, PnL, holdings
GET  /trades/history         → paginated trade list
GET  /strategy/list          → registered strategies + status
POST /strategy/start         → { strategyName, instrument, mode: 'paper'|'live' }
POST /strategy/stop          → { strategyRunId }
POST /backtest/run           → { strategyName, instrument, from, to }
GET  /backtest/:id/report    → performance report
GET  /market/instruments     → search Upstox instrument list
GET  /market/candles         → OHLCV for charting
```

### Auth Flow
```
GET /auth/login → redirect to Upstox OAuth URL
GET /auth/callback → capture code → exchange for tokens → store in SQLite
GET /auth/status → token valid/expired
```

---

## Database Schema

```sql
-- Auth
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Market data cache
CREATE TABLE candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_key TEXT NOT NULL,
  interval TEXT NOT NULL,
  open REAL, high REAL, low REAL, close REAL, volume INTEGER,
  timestamp TEXT NOT NULL,
  UNIQUE(instrument_key, interval, timestamp)
);

-- Orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_run_id INTEGER,
  instrument_key TEXT NOT NULL,
  action TEXT NOT NULL,       -- BUY | SELL
  quantity INTEGER NOT NULL,
  price REAL,                 -- null = market order
  status TEXT NOT NULL,       -- PENDING | OPEN | FILLED | CANCELLED | REJECTED
  mode TEXT NOT NULL,         -- paper | live
  upstox_order_id TEXT,       -- null for paper orders
  filled_at TEXT,
  created_at TEXT NOT NULL
);

-- Positions
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_key TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  avg_price REAL NOT NULL,
  mode TEXT NOT NULL,         -- paper | live
  opened_at TEXT NOT NULL
);

-- Portfolio snapshots
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_balance REAL NOT NULL,
  mode TEXT NOT NULL,
  taken_at TEXT NOT NULL
);

-- Strategy runs
CREATE TABLE strategy_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_name TEXT NOT NULL,
  instrument_key TEXT NOT NULL,
  mode TEXT NOT NULL,
  config TEXT,                -- JSON blob for strategy params
  started_at TEXT NOT NULL,
  stopped_at TEXT
);

-- Backtest reports
CREATE TABLE backtest_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_run_id INTEGER NOT NULL,
  pnl REAL,
  win_rate REAL,
  max_drawdown REAL,
  sharpe REAL,
  trade_count INTEGER,
  report_json TEXT,           -- full trade log as JSON
  created_at TEXT NOT NULL
);

-- Notification log
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
```

---

## Frontend Pages

| Page | Data source |
|------|------------|
| Dashboard | Portfolio snapshot, active strategies, today's PnL |
| Trading | Start/stop strategies, live position monitor |
| History | Paginated trade history, backtest results |
| Balance | Cash balance, holdings, realized/unrealized PnL |

Frontend is a **separate application** (not served by Bun). Communicates with Bun server via REST. Tech stack TBD by user.

---

## Key Design Decisions

1. **`mode` column everywhere** — paper and live data coexist in the same DB, cleanly separated by `mode` flag. No separate DBs needed.
2. **Strategy is mode-agnostic** — `placeOrder` in `StrategyContext` is the only seam. Paper vs live is an infrastructure concern, not a strategy concern.
3. **SQLite candle cache** — Upstox historical API has rate limits. Cache all fetched candles; backtest re-runs are instant.
4. **Bun-native** — use `bun:sqlite`, `Bun.serve`, Bun WebSocket. No Express, no better-sqlite3.
5. **Modular boundaries enforced by convention** — modules import from `shared/` and their own files only. No cross-module imports.

---

## Macro Plan (Phases)

### Phase 1 — Foundation
- [ ] Project structure scaffold (all module folders)
- [ ] `shared/config.ts` — env vars (Upstox credentials, Telegram token)
- [ ] `shared/db.ts` — SQLite singleton + migrations runner
- [ ] All DB tables created via migrations
- [ ] `auth` module — Upstox OAuth2 login + token refresh
- [ ] Basic API server with auth routes

### Phase 2 — Market Data
- [ ] `market-data` module — Upstox historical OHLCV fetch
- [ ] Candle cache in SQLite
- [ ] Upstox WebSocket live feed integration
- [ ] Market data API endpoints (`/market/instruments`, `/market/candles`)

### Phase 3 — Strategy Framework
- [ ] `Strategy` abstract base class
- [ ] `StrategyRunner` — paper mode first
- [ ] Strategy registry
- [ ] Write one sample strategy (e.g. SMA crossover) to validate framework
- [ ] Strategy API endpoints (list, start, stop)

### Phase 4 — Orders & Portfolio
- [ ] `orders` module — paper order simulation (fill at candle close)
- [ ] `portfolio` module — virtual balance, PnL tracking
- [ ] Portfolio API endpoints
- [ ] Live order execution via Upstox API
- [ ] Order status polling

### Phase 5 — Backtesting
- [ ] `backtest` module — historical replay engine
- [ ] Performance metrics: PnL, win rate, drawdown, Sharpe
- [ ] Backtest API endpoints
- [ ] Backtest report storage

### Phase 6 — Notifications
- [ ] `notifications` module — Telegram bot setup
- [ ] Trade fill alerts
- [ ] Daily PnL summary
- [ ] Error alerts

### Phase 7 — Frontend
- [ ] Choose frontend framework (React / SvelteKit / Next.js)
- [ ] Dashboard page
- [ ] Trading page (start/stop strategies, live positions)
- [ ] History page (trades, backtest results)
- [ ] Balance page

### Phase 8 — Production Hardening
- [ ] Error handling + retry logic for Upstox API
- [ ] Token refresh edge cases
- [ ] Rate limit handling
- [ ] Logging
- [ ] VPS deployment (Dockerfile or systemd service)
- [ ] Market hours guard (don't trade outside NSE hours)
