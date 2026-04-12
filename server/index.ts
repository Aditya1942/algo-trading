import { config } from "./shared/config"
import { withHttpLogging } from "./shared/app-logger"
import { handleLogin, handleCallback } from "./api/auth"
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

    // API v1
    "/api/v1/user/profile":           { GET: L((req) => handleGetProfile(req)) },
    "/api/v1/user/funds-and-margin": { GET: L((req) => handleGetFundsAndMargin(req)) },
    "/api/v1/portfolio/holdings":  { GET: L((req) => handleGetHoldings(req)) },
    "/api/v1/order/history":       { GET: L((req) => handleGetOrderHistory(req)) },

    // Health (keep for infra checks)
    "/api/v1/health": {
      GET: L(() => Response.json({ healthy: true })),
    },
  },
  fetch: L((_req) => Response.json({ error: "not_found" }, { status: 404 })),
})

console.log(`Server running on http://localhost:${config.port}`)
