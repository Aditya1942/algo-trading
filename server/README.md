# Algo Trading Platform

Generic algorithmic trading platform powered by the [Upstox API](https://upstox.com/developer/api-documentation/). Write your own strategies — the framework handles paper trading, live execution, backtesting, and alerts.

## Stack

- **Runtime:** [Bun](https://bun.sh) + TypeScript
- **Database:** SQLite (`bun:sqlite`)
- **Broker API:** Upstox (historical data + live trading)
- **Alerts:** Telegram Bot API
- **Architecture:** Modular monolith

## Features

- **Generic strategy framework** — extend `Strategy`, implement `onCandle`, done
- **Paper trading + live trading** — same strategy class, different mode
- **Backtesting** — replay historical OHLCV through your strategy, get PnL report
- **Instruments** — NSE equity, NSE F&O, BSE
- **Telegram alerts** — trade fills, PnL milestones, daily summary
- **REST API** — for frontend dashboard (dashboard, trading, history, balance pages)

## Project Structure

```
server/
  modules/
    auth/           ← Upstox OAuth2 token lifecycle
    market-data/    ← historical OHLCV + live WebSocket feed
    strategy/       ← Strategy base class, StrategyRunner, registry
    orders/         ← order placement + position tracking
    portfolio/      ← balance, PnL, holdings
    backtest/       ← historical replay engine + performance reports
    notifications/  ← Telegram bot
  api/              ← HTTP routes (thin layer, no business logic)
  shared/
    db.ts           ← SQLite singleton
    upstox.ts       ← Upstox HTTP + WebSocket client
    types.ts        ← shared types (Candle, Order, Signal, etc.)
    config.ts       ← env vars
  index.ts          ← entry point
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- Upstox developer account + API credentials
- Telegram bot token (via [@BotFather](https://t.me/BotFather))

### Install

```bash
bun install
```

### Configure

Copy `.env.example` to `.env` and fill in:

```env
UPSTOX_CLIENT_ID=
UPSTOX_CLIENT_SECRET=
UPSTOX_REDIRECT_URI=http://localhost:8081/auth/callback
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Run

```bash
bun run index.ts
```

Server starts on `http://localhost:8081`.

### Authenticate with Upstox

Open `http://localhost:8081/auth/login` in your browser. Complete the OAuth flow once — token is stored in SQLite and auto-refreshed.

## Writing a Strategy

```typescript
import { Strategy, Signal, Candle, StrategyContext } from '../shared/types'

export class SmaCrossover extends Strategy {
  name = 'sma-crossover'
  private prices: number[] = []

  onStart() {
    this.prices = []
  }

  onStop() {}

  onCandle(candle: Candle, ctx: StrategyContext): Signal | null {
    this.prices.push(candle.close)
    if (this.prices.length < 20) return null

    const sma5 = avg(this.prices.slice(-5))
    const sma20 = avg(this.prices.slice(-20))

    if (sma5 > sma20) return { action: 'BUY', quantity: 1 }
    if (sma5 < sma20) return { action: 'SELL', quantity: 1 }
    return null
  }
}
```

Run in paper mode:
```bash
POST /strategy/start
{ "strategyName": "sma-crossover", "instrument": "NSE_EQ|INE002A01018", "mode": "paper" }
```

Run backtest:
```bash
POST /backtest/run
{ "strategyName": "sma-crossover", "instrument": "NSE_EQ|INE002A01018", "from": "2024-01-01", "to": "2024-12-31" }
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Start Upstox OAuth flow |
| GET | `/auth/status` | Token valid/expired |
| GET | `/portfolio` | Balance, PnL, holdings |
| GET | `/trades/history` | Paginated trade history |
| GET | `/strategy/list` | Registered strategies + status |
| POST | `/strategy/start` | Start strategy (paper or live) |
| POST | `/strategy/stop` | Stop running strategy |
| POST | `/backtest/run` | Run backtest |
| GET | `/backtest/:id/report` | Backtest performance report |
| GET | `/market/instruments` | Search instruments |
| GET | `/market/candles` | OHLCV data for charting |

## Roadmap

- [x] Bun + SQLite server scaffold
- [ ] Auth module (Upstox OAuth2)
- [ ] Market data module (historical + WebSocket)
- [ ] Strategy framework (base class + runner)
- [ ] Orders + portfolio modules
- [ ] Backtesting engine
- [ ] Telegram notifications
- [ ] Frontend dashboard
- [ ] VPS deployment

## Design Spec

Full architecture spec at [`docs/superpowers/specs/2026-04-12-algo-trading-design.md`](docs/superpowers/specs/2026-04-12-algo-trading-design.md).
