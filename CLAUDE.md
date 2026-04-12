# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required Plugins — Always Active

Every session must use all three:

1. **Caveman** — active from first response. Default level: `full`. Communicate terse, drop filler, keep all technical substance. Disable only if user says "stop caveman" or "normal mode".

2. **Claude Memory (`claude-mem`)** — check memory at session start. Use `mem-search` skill before diving into unfamiliar work. Save observations (features, bugs, decisions, discoveries) as work progresses.

3. **Superpowers** — invoke the `superpowers:using-superpowers` skill at session start. Before any task, check if a skill applies (brainstorm, debug, TDD, plan, etc.). 1% chance = invoke it.

## Commands

```bash
# Start everything (client + server concurrently)
bun run dev

# Server only (hot reload)
bun run server        # = cd server && bun --hot run index.ts

# Client only (hot reload)
bun run client        # = cd client && bun --hot run index.ts

# Install deps (from root or inside server/)
bun install

# Run tests
bun test              # run from server/ or client/

# Single test file
bun test path/to/file.test.ts
```

## Bun-First Rules

All code must use Bun APIs — never Node/npm/vite equivalents:

| Use | Not |
|-----|-----|
| `Bun.serve()` | express |
| `bun:sqlite` | better-sqlite3 |
| `Bun.file` | fs.readFile/writeFile |
| `Bun.$\`cmd\`` | execa |
| `bun test` | jest / vitest |
| `bun build` | webpack / esbuild / vite |
| `bun install` | npm / pnpm / yarn |

Bun loads `.env` automatically — no dotenv.

Frontend: serve HTML files via `Bun.serve()` routes. HTML files import `.tsx` directly; Bun bundles automatically.

## Architecture

Monorepo with two apps:

```
algo-trading/
  package.json        ← root scripts only (dev/server/client)
  server/             ← Bun HTTP API + all trading logic
  client/             ← Vite + React dashboard (shadcn/ui — see client/CLAUDE.md)
```

### Server: Modular Monolith

```
server/
  modules/
    auth/             ← Upstox OAuth2 — token storage + auto-refresh
    market-data/      ← historical OHLCV fetch + live WebSocket feed
    strategy/         ← Strategy base class, StrategyRunner, registry
    orders/           ← order placement, state machine, positions
    portfolio/        ← balance, PnL, holdings, trade history
    backtest/         ← historical replay engine, performance reports
    notifications/    ← Telegram bot alerts
  api/                ← thin HTTP route layer only, wires modules together
  shared/
    db.ts             ← SQLite singleton (bun:sqlite)
    upstox.ts         ← Upstox HTTP + WebSocket client
    types.ts          ← Candle, Order, Position, Instrument, Signal
    config.ts         ← env vars
  index.ts            ← entry point
```

**Key rules:**
- Each module owns its own DB access. No module reaches into another's internals.
- Modules communicate via typed function calls only. No circular dependencies.
- `api/` is a thin layer — no business logic there.
- `shared/upstox.ts` is the single Upstox client, used by all modules.

**REST API:** Every HTTP JSON route on the server uses the prefix `/api/v1/` (for example `/api/v1/health`). OAuth and other browser redirect handlers stay at the server root (for example `/auth/callback`) so `UPSTOX_REDIRECT_URI` does not need the API prefix.

### Strategy Framework

Users extend `Strategy` and implement `onCandle`. `StrategyRunner` feeds candles and routes signals to paper engine or live Upstox orders — the strategy never knows the difference.

```typescript
abstract class Strategy {
  abstract name: string
  abstract onCandle(candle: Candle, ctx: StrategyContext): Signal | null
  abstract onStart(): void
  abstract onStop(): void
}

interface StrategyContext {
  instrument: Instrument
  portfolio: PortfolioSnapshot
  placeOrder: (signal: Signal) => Promise<Order>
}
```

Backtest replays cached historical candles through `StrategyRunner` in paper mode.

### Data Flow

```
Upstox WebSocket → market-data → StrategyRunner → strategy.onCandle()
                                                         ↓
                                              Signal → orders (paper | live)
                                                         ↓
                                              portfolio updated → notifications
```

## Environment Variables

```env
UPSTOX_CLIENT_ID=
UPSTOX_CLIENT_SECRET=
UPSTOX_REDIRECT_URI=http://localhost:8081/auth/callback
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Upstox auth: visit `http://localhost:8081/auth/login` once. Token persists in SQLite and auto-refreshes.

## Design Spec

Full architecture spec: `server/docs/superpowers/specs/2026-04-12-algo-trading-design.md`
