import { config } from "./shared/config"
import { withHttpLogging } from "./shared/app-logger"
import { matchRoute } from "./api/_router"

// Auth
import { handleLogin, handleCallback, handleUpstoxLogout, handleWebhookToken } from "./api/auth"
import { handleLogout } from "./api/logout"

// User
import {
  handleGetProfile, handleGetFundsAndMargin, handleGetFundsAndMarginV2,
  handleGetIp, handleUpdateIp, handleGetKillSwitch, handlePostKillSwitch,
} from "./api/user"

// Orders
import {
  handlePlaceOrder, handlePlaceOrderV3, handleModifyOrder, handleModifyOrderV3,
  handleCancelOrder, handleCancelOrderV3, handleGetOrderBook, handleGetOrderDetails,
  handleGetOrderHistory, handleGetOrderTrades, handleGetTradesToday,
  handleMultiPlaceOrder, handleMultiCancelOrder, handleExitPositions,
} from "./api/orders"

// GTT
import { handlePlaceGtt, handleModifyGtt, handleCancelGtt, handleGetGttOrders } from "./api/gtt"

// Portfolio
import { handleGetHoldings, handleGetPositions, handleConvertPosition, handleGetMtfPositions } from "./api/portfolio"

// Charges
import { handleGetBrokerage, handleGetHistoricalCharges, handlePostMarginCharges } from "./api/charges"

// Trade P&L
import { handleGetPnlCharges, handleGetPnlData, handleGetPnlMetadata } from "./api/trade-pnl"

// Market quotes + info
import {
  handleGetLtp, handleGetOhlc, handleGetQuotes,
  handleGetLtpV3, handleGetOhlcV3, handleGetOptionGreek,
  handleGetHolidays, registerMarketRoutes,
} from "./api/market"

// Options
import { handleGetOptionChain, handleGetOptionContract } from "./api/options"

// Instruments
import { handleSearchInstruments } from "./api/instruments"

// Expired instruments
import {
  handleGetExpiries, handleGetExpiredFutureContract, handleGetExpiredOptionContract,
  registerExpiredInstrumentRoutes,
} from "./api/expired-instruments"

// Feed
import {
  handleGetMarketDataFeed, handleAuthorizeMarketDataFeed,
  handleGetPortfolioStreamFeed, handleAuthorizePortfolioStreamFeed,
} from "./api/feed"

// Historical candles (dynamic routes only)
import { registerHistoricalRoutes } from "./api/historical"

// Auth (dynamic route for webhook token)
import { addDynamicRoute } from "./api/_router"

const L = withHttpLogging

// --- Register dynamic routes ---
registerHistoricalRoutes()
registerMarketRoutes()
registerExpiredInstrumentRoutes()
addDynamicRoute("POST", "/api/v1/upstox/auth/webhook-token/:client_id", handleWebhookToken)

Bun.serve({
  port: config.port,
  routes: {
    // Auth (root — no /api/v1/ prefix, Upstox redirect URI must match)
    "/auth/login":    { GET: L((req) => handleLogin(req)) },
    "/auth/callback": { GET: L((req) => handleCallback(req)) },

    // --- User ---
    "/api/v1/upstox/user/profile":             { GET: L((req) => handleGetProfile(req)) },
    "/api/v1/upstox/user/funds-and-margin":     { GET: L((req) => handleGetFundsAndMargin(req)) },
    "/api/v1/upstox/user/funds-and-margin-v2":  { GET: L((req) => handleGetFundsAndMarginV2(req)) },
    "/api/v1/upstox/user/ip":                   { GET: L((req) => handleGetIp(req)), PUT: L((req) => handleUpdateIp(req)) },
    "/api/v1/upstox/user/kill-switch":           { GET: L((req) => handleGetKillSwitch(req)), POST: L((req) => handlePostKillSwitch(req)) },

    // --- Orders ---
    "/api/v1/upstox/order/place":              { POST: L((req) => handlePlaceOrder(req)) },
    "/api/v1/upstox/v3/order/place":           { POST: L((req) => handlePlaceOrderV3(req)) },
    "/api/v1/upstox/order/modify":             { PUT: L((req) => handleModifyOrder(req)) },
    "/api/v1/upstox/v3/order/modify":          { PUT: L((req) => handleModifyOrderV3(req)) },
    "/api/v1/upstox/order/cancel":             { DELETE: L((req) => handleCancelOrder(req)) },
    "/api/v1/upstox/v3/order/cancel":          { DELETE: L((req) => handleCancelOrderV3(req)) },
    "/api/v1/upstox/order/book":               { GET: L((req) => handleGetOrderBook(req)) },
    "/api/v1/upstox/order/details":            { GET: L((req) => handleGetOrderDetails(req)) },
    "/api/v1/upstox/order/history":            { GET: L((req) => handleGetOrderHistory(req)) },
    "/api/v1/upstox/order/trades":             { GET: L((req) => handleGetOrderTrades(req)) },
    "/api/v1/upstox/order/trades/today":       { GET: L((req) => handleGetTradesToday(req)) },
    "/api/v1/upstox/order/multi/place":        { POST: L((req) => handleMultiPlaceOrder(req)) },
    "/api/v1/upstox/order/multi/cancel":       { DELETE: L((req) => handleMultiCancelOrder(req)) },
    "/api/v1/upstox/order/positions/exit":     { POST: L((req) => handleExitPositions(req)) },

    // --- GTT ---
    "/api/v1/upstox/v3/order/gtt/place":       { POST: L((req) => handlePlaceGtt(req)) },
    "/api/v1/upstox/v3/order/gtt/modify":      { PUT: L((req) => handleModifyGtt(req)) },
    "/api/v1/upstox/v3/order/gtt/cancel":      { DELETE: L((req) => handleCancelGtt(req)) },
    "/api/v1/upstox/v3/order/gtt":             { GET: L((req) => handleGetGttOrders(req)) },

    // --- Portfolio ---
    "/api/v1/upstox/portfolio/holdings":        { GET: L((req) => handleGetHoldings(req)) },
    "/api/v1/upstox/portfolio/positions":        { GET: L((req) => handleGetPositions(req)) },
    "/api/v1/upstox/portfolio/convert-position": { PUT: L((req) => handleConvertPosition(req)) },
    "/api/v1/upstox/v3/portfolio/mtf-positions": { GET: L((req) => handleGetMtfPositions(req)) },

    // --- Charges ---
    "/api/v1/upstox/charges/brokerage":          { GET: L((req) => handleGetBrokerage(req)) },
    "/api/v1/upstox/charges/historical-trades":  { GET: L((req) => handleGetHistoricalCharges(req)) },
    "/api/v1/upstox/charges/margin":             { POST: L((req) => handlePostMarginCharges(req)) },

    // --- Trade P&L ---
    "/api/v1/upstox/trade/pnl/charges":   { GET: L((req) => handleGetPnlCharges(req)) },
    "/api/v1/upstox/trade/pnl/data":      { GET: L((req) => handleGetPnlData(req)) },
    "/api/v1/upstox/trade/pnl/metadata":  { GET: L((req) => handleGetPnlMetadata(req)) },

    // --- Market quotes ---
    "/api/v1/upstox/market-quote/ltp":                 { GET: L((req) => handleGetLtp(req)) },
    "/api/v1/upstox/market-quote/ohlc":                { GET: L((req) => handleGetOhlc(req)) },
    "/api/v1/upstox/market-quote/quotes":              { GET: L((req) => handleGetQuotes(req)) },
    "/api/v1/upstox/v3/market-quote/ltp":              { GET: L((req) => handleGetLtpV3(req)) },
    "/api/v1/upstox/v3/market-quote/ohlc":             { GET: L((req) => handleGetOhlcV3(req)) },
    "/api/v1/upstox/v3/market-quote/option-greek":     { GET: L((req) => handleGetOptionGreek(req)) },
    "/api/v1/upstox/market/holidays":                  { GET: L((req) => handleGetHolidays(req)) },

    // --- Options ---
    "/api/v1/upstox/option/chain":     { GET: L((req) => handleGetOptionChain(req)) },
    "/api/v1/upstox/option/contract":  { GET: L((req) => handleGetOptionContract(req)) },

    // --- Instruments ---
    "/api/v1/upstox/instruments/search": { GET: L((req) => handleSearchInstruments(req)) },

    // --- Expired instruments ---
    "/api/v1/upstox/expired-instruments/expiries":        { GET: L((req) => handleGetExpiries(req)) },
    "/api/v1/upstox/expired-instruments/future/contract":  { GET: L((req) => handleGetExpiredFutureContract(req)) },
    "/api/v1/upstox/expired-instruments/option/contract":  { GET: L((req) => handleGetExpiredOptionContract(req)) },

    // --- Feed ---
    "/api/v1/upstox/feed/market-data-feed":               { GET: L((req) => handleGetMarketDataFeed(req)) },
    "/api/v1/upstox/feed/market-data-feed/authorize":      { GET: L((req) => handleAuthorizeMarketDataFeed(req)) },
    "/api/v1/upstox/feed/portfolio-stream-feed":           { GET: L((req) => handleGetPortfolioStreamFeed(req)) },
    "/api/v1/upstox/feed/portfolio-stream-feed/authorize": { GET: L((req) => handleAuthorizePortfolioStreamFeed(req)) },

    // --- Auth ---
    "/api/v1/upstox/auth/logout": {
      POST: L(() => handleLogout()),           // local DB clear
      DELETE: L((req) => handleUpstoxLogout(req)),  // Upstox-side logout
    },

    // --- Health ---
    "/api/v1/health": {
      GET: L(() => Response.json({ healthy: true })),
    },
  },
  fetch: L(async (req) => {
    const match = matchRoute(req)
    if (match) return match.handler(req, match.params)
    return Response.json({ error: "not_found" }, { status: 404 })
  }),
})

console.log(`Server running on http://localhost:${config.port}`)
