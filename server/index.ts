import { config } from "./shared/config"
import { withHttpLogging } from "./shared/app-logger"
import { handleLogin, handleCallback } from "./api/auth"
import { handleLogout } from "./api/logout"
import { handleGetFundsAndMargin, handleGetProfile } from "./api/user"
import { handleGetHoldings } from "./api/portfolio"
import { handleGetOrderHistory } from "./api/orders"

const L = withHttpLogging

Bun.serve({
  port: config.port,
  routes: {
    // Auth (root — no /api/v1/ prefix, Upstox redirect URI must match)
    "/auth/login":    { GET: L((req) => handleLogin(req)) },
    "/auth/callback": { GET: L((req) => handleCallback(req)) },

    // API v1 — Upstox proxies
    "/api/v1/upstox/user/profile":           { GET: L((req) => handleGetProfile(req)) },
    "/api/v1/upstox/user/funds-and-margin": { GET: L((req) => handleGetFundsAndMargin(req)) },
    "/api/v1/upstox/portfolio/holdings":  { GET: L((req) => handleGetHoldings(req)) },
    "/api/v1/upstox/order/history":       { GET: L((req) => handleGetOrderHistory(req)) },
    "/api/v1/upstox/auth/logout": { POST: L(() => handleLogout()) },

    // Health (infra; not Upstox)

    "/api/v1/health": {
      GET: L(() => Response.json({ healthy: true })),
    },
  },
  fetch: L((_req) => Response.json({ error: "not_found" }, { status: 404 })),
})

console.log(`Server running on http://localhost:${config.port}`)
