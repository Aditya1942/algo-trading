import { config } from "./shared/config"
import { handleLogin, handleCallback } from "./api/auth"
import { handleGetProfile } from "./api/user"
import { handleGetHoldings } from "./api/portfolio"
import { handleGetOrderHistory } from "./api/orders"

Bun.serve({
  port: config.port,
  routes: {
    // Auth (root — no /api/v1/ prefix, Upstox redirect URI must match)
    "/auth/login":    { GET: (req) => handleLogin(req) },
    "/auth/callback": { GET: (req) => handleCallback(req) },

    // API v1
    "/api/v1/user/profile":        { GET: (req) => handleGetProfile(req) },
    "/api/v1/portfolio/holdings":  { GET: (req) => handleGetHoldings(req) },
    "/api/v1/order/history":       { GET: (req) => handleGetOrderHistory(req) },

    // Health (keep for infra checks)
    "/api/v1/health": {
      GET: () => Response.json({ healthy: true }),
    },
  },
})

console.log(`Server running on http://localhost:${config.port}`)
