// server/api/routes.test.ts

// Set env vars before importing auth module
process.env.UPSTOX_CLIENT_ID = "test_client_id"
process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"

import { test, expect, mock } from "bun:test"
import { AuthError, UpstoxError } from "../shared/types"

// =========================================================================
// User handlers
// =========================================================================

test("GET /api/v1/upstox/user/profile proxies Upstox response", async () => {
  const fakeData = { status: "success", data: { email: "test@example.com", name: "Test" } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetProfile } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/profile")
  const res = await handleGetProfile(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/upstox/user/profile returns 401 when not authenticated", async () => {
  const mockUpstoxGet = mock(() => Promise.reject(new AuthError("not_authenticated", "Visit /auth/login first")))

  const { handleGetProfile } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/profile")
  const res = await handleGetProfile(req, mockUpstoxGet)

  expect(res.status).toBe(401)
  const body = await res.json() as { error: string }
  expect(body.error).toBe("not_authenticated")
})

test("GET /api/v1/upstox/user/funds-and-margin proxies Upstox v3 response", async () => {
  const fakeData = {
    status: "success",
    data: { available_to_trade: { total: 1000 }, unavailable_to_trade: {} },
  }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetFundsAndMargin } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/funds-and-margin")
  const res = await handleGetFundsAndMargin(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/upstox/user/funds-and-margin-v2 proxies v2 response", async () => {
  const fakeData = { status: "success", data: { equity: {} } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetFundsAndMarginV2 } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/funds-and-margin-v2")
  const res = await handleGetFundsAndMarginV2(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/upstox/user/ip proxies response", async () => {
  const fakeData = { status: "success", data: { ip_addresses: ["1.2.3.4"] } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetIp } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/ip")
  const res = await handleGetIp(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("PUT /api/v1/upstox/user/ip forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPut = mock(() => Promise.resolve(fakeResp))

  const { handleUpdateIp } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/ip", {
    method: "PUT",
    body: JSON.stringify({ ip_addresses: ["5.6.7.8"] }),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handleUpdateIp(req, mockUpstoxPut)

  expect(res.status).toBe(200)
  expect(mockUpstoxPut).toHaveBeenCalledWith("/user/ip", { ip_addresses: ["5.6.7.8"] })
})

test("GET /api/v1/upstox/user/kill-switch proxies response", async () => {
  const fakeData = { status: "success", data: { enabled: false } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetKillSwitch } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/kill-switch")
  const res = await handleGetKillSwitch(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

test("POST /api/v1/upstox/user/kill-switch forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handlePostKillSwitch } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/upstox/user/kill-switch", {
    method: "POST",
    body: JSON.stringify({ enabled: true }),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handlePostKillSwitch(req, mockUpstoxPost)

  expect(res.status).toBe(200)
  expect(mockUpstoxPost).toHaveBeenCalledWith("/user/kill-switch", { enabled: true })
})

// =========================================================================
// Portfolio handlers
// =========================================================================

test("GET /api/v1/upstox/portfolio/holdings proxies Upstox response", async () => {
  const fakeData = { status: "success", data: [{ isin: "INE002A01018", quantity: 10 }] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetHoldings } = await import("./portfolio")
  const req = new Request("http://localhost:8081/api/v1/upstox/portfolio/holdings")
  const res = await handleGetHoldings(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/upstox/portfolio/positions proxies response", async () => {
  const fakeData = { status: "success", data: [{ instrument_token: "NSE_EQ|INE002A01018" }] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetPositions } = await import("./portfolio")
  const req = new Request("http://localhost:8081/api/v1/upstox/portfolio/positions")
  const res = await handleGetPositions(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("PUT /api/v1/upstox/portfolio/convert-position forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPut = mock(() => Promise.resolve(fakeResp))

  const { handleConvertPosition } = await import("./portfolio")
  const req = new Request("http://localhost:8081/api/v1/upstox/portfolio/convert-position", {
    method: "PUT",
    body: JSON.stringify({ instrument_token: "NSE_EQ|INE002A01018", new_product: "D" }),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handleConvertPosition(req, mockUpstoxPut)

  expect(res.status).toBe(200)
})

// =========================================================================
// Order handlers
// =========================================================================

test("GET /api/v1/upstox/order/history proxies Upstox response", async () => {
  const fakeData = { status: "success", data: [{ order_id: "ord_123", status: "complete" }] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetOrderHistory } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/history")
  const res = await handleGetOrderHistory(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/upstox/order/history forwards Upstox error status", async () => {
  const mockUpstoxGet = mock(() => Promise.reject(new UpstoxError(403, { message: "Forbidden" })))

  const { handleGetOrderHistory } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/history")
  const res = await handleGetOrderHistory(req, mockUpstoxGet)

  expect(res.status).toBe(403)
})

test("POST /api/v1/upstox/order/place forwards body", async () => {
  const fakeResp = { status: "success", data: { order_id: "ord_456" } }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handlePlaceOrder } = await import("./orders")
  const orderBody = { quantity: 1, product: "D", validity: "DAY", price: 100, instrument_token: "NSE_EQ|INE002A01018", order_type: "LIMIT", transaction_type: "BUY" }
  const req = new Request("http://localhost:8081/api/v1/upstox/order/place", {
    method: "POST",
    body: JSON.stringify(orderBody),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handlePlaceOrder(req, mockUpstoxPost)

  expect(res.status).toBe(200)
  expect(mockUpstoxPost).toHaveBeenCalledWith("/order/place", orderBody)
})

test("PUT /api/v1/upstox/order/modify forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPut = mock(() => Promise.resolve(fakeResp))

  const { handleModifyOrder } = await import("./orders")
  const modifyBody = { order_id: "ord_123", quantity: 2 }
  const req = new Request("http://localhost:8081/api/v1/upstox/order/modify", {
    method: "PUT",
    body: JSON.stringify(modifyBody),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handleModifyOrder(req, mockUpstoxPut)

  expect(res.status).toBe(200)
  expect(mockUpstoxPut).toHaveBeenCalledWith("/order/modify", modifyBody)
})

test("DELETE /api/v1/upstox/order/cancel forwards query params", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxDelete = mock(() => Promise.resolve(fakeResp))

  const { handleCancelOrder } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/cancel?order_id=ord_123", {
    method: "DELETE",
  })
  const res = await handleCancelOrder(req, mockUpstoxDelete)

  expect(res.status).toBe(200)
  expect(mockUpstoxDelete).toHaveBeenCalledWith("/order/cancel?order_id=ord_123")
})

test("GET /api/v1/upstox/order/book proxies response", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetOrderBook } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/book")
  const res = await handleGetOrderBook(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

test("GET /api/v1/upstox/order/details forwards query", async () => {
  const fakeData = { status: "success", data: { order_id: "ord_1" } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetOrderDetails } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/details?order_id=ord_1")
  const res = await handleGetOrderDetails(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/order/details?order_id=ord_1")
})

test("GET /api/v1/upstox/order/trades/today proxies response", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetTradesToday } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/upstox/order/trades/today")
  const res = await handleGetTradesToday(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

test("POST /api/v1/upstox/order/multi/place forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handleMultiPlaceOrder } = await import("./orders")
  const body = [{ quantity: 1 }, { quantity: 2 }]
  const req = new Request("http://localhost:8081/api/v1/upstox/order/multi/place", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handleMultiPlaceOrder(req, mockUpstoxPost)

  expect(res.status).toBe(200)
  expect(mockUpstoxPost).toHaveBeenCalledWith("/order/multi/place", body)
})

test("POST /api/v1/upstox/order/positions/exit forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handleExitPositions } = await import("./orders")
  const body = { instrument_token: "NSE_EQ|INE002A01018" }
  const req = new Request("http://localhost:8081/api/v1/upstox/order/positions/exit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handleExitPositions(req, mockUpstoxPost)

  expect(res.status).toBe(200)
})

// =========================================================================
// GTT handlers
// =========================================================================

test("POST /api/v1/upstox/v3/order/gtt/place forwards body", async () => {
  const fakeResp = { status: "success", data: { gtt_order_id: "gtt_1" } }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handlePlaceGtt } = await import("./gtt")
  const body = { instrument_token: "NSE_EQ|INE002A01018", trigger_price: 100 }
  const req = new Request("http://localhost:8081/api/v1/upstox/v3/order/gtt/place", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handlePlaceGtt(req, mockUpstoxPost)

  expect(res.status).toBe(200)
})

test("GET /api/v1/upstox/v3/order/gtt forwards query", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetGttOrders } = await import("./gtt")
  const req = new Request("http://localhost:8081/api/v1/upstox/v3/order/gtt?page=1")
  const res = await handleGetGttOrders(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/order/gtt?page=1", undefined, { version: 3 })
})

// =========================================================================
// Charges handlers
// =========================================================================

test("GET /api/v1/upstox/charges/brokerage forwards query", async () => {
  const fakeData = { status: "success", data: { total: 20 } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetBrokerage } = await import("./charges")
  const req = new Request("http://localhost:8081/api/v1/upstox/charges/brokerage?instrument_token=NSE_EQ%7CINE002A01018")
  const res = await handleGetBrokerage(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/charges/brokerage?instrument_token=NSE_EQ%7CINE002A01018")
})

test("POST /api/v1/upstox/charges/margin forwards body", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handlePostMarginCharges } = await import("./charges")
  const body = { instrument_token: "NSE_EQ|INE002A01018", quantity: 1, transaction_type: "BUY" }
  const req = new Request("http://localhost:8081/api/v1/upstox/charges/margin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
  const res = await handlePostMarginCharges(req, mockUpstoxPost)

  expect(res.status).toBe(200)
})

// =========================================================================
// Trade P&L handlers
// =========================================================================

test("GET /api/v1/upstox/trade/pnl/data forwards query", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetPnlData } = await import("./trade-pnl")
  const req = new Request("http://localhost:8081/api/v1/upstox/trade/pnl/data?segment=EQ&financial_year=2425")
  const res = await handleGetPnlData(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/trade/profit-loss/data?segment=EQ&financial_year=2425")
})

test("GET /api/v1/upstox/trade/pnl/metadata proxies response", async () => {
  const fakeData = { status: "success", data: {} }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetPnlMetadata } = await import("./trade-pnl")
  const req = new Request("http://localhost:8081/api/v1/upstox/trade/pnl/metadata?segment=EQ&financial_year=2425")
  const res = await handleGetPnlMetadata(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

// =========================================================================
// Historical candle handlers (path params)
// =========================================================================

test("handleIntradayCandle builds correct Upstox path", async () => {
  const fakeData = { status: "success", data: { candles: [] } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleIntradayCandle } = await import("./historical")
  const req = new Request("http://localhost:8081/api/v1/upstox/historical-candle/intraday/NSE_EQ%7CINE002A01018/1minute")
  const res = await handleIntradayCandle(req, { key: "NSE_EQ|INE002A01018", interval: "1minute" }, { upstoxGet: mockUpstoxGet })

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/historical-candle/intraday/NSE_EQ%7CINE002A01018/1minute")
})

test("handleHistoricalCandleRange builds correct path with from/to", async () => {
  const fakeData = { status: "success", data: { candles: [] } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleHistoricalCandleRange } = await import("./historical")
  const params = { key: "NSE_EQ|INE002A01018", interval: "day", to: "2024-01-31", from: "2024-01-01" }
  const req = new Request("http://localhost:8081/test")
  const res = await handleHistoricalCandleRange(req, params, { upstoxGet: mockUpstoxGet })

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/historical-candle/NSE_EQ%7CINE002A01018/day/2024-01-31/2024-01-01")
})

// =========================================================================
// Market handlers
// =========================================================================

test("GET /api/v1/upstox/market-quote/ltp forwards query", async () => {
  const fakeData = { status: "success", data: {} }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetLtp } = await import("./market")
  const req = new Request("http://localhost:8081/api/v1/upstox/market-quote/ltp?instrument_key=NSE_EQ%7CINE002A01018")
  const res = await handleGetLtp(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/market-quote/ltp?instrument_key=NSE_EQ%7CINE002A01018")
})

test("GET /api/v1/upstox/market/holidays proxies response", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetHolidays } = await import("./market")
  const req = new Request("http://localhost:8081/api/v1/upstox/market/holidays")
  const res = await handleGetHolidays(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

test("handleGetHolidaysByDate passes date param", async () => {
  const fakeData = { status: "success", data: {} }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetHolidaysByDate } = await import("./market")
  const req = new Request("http://localhost:8081/api/v1/upstox/market/holidays/2024-01-26")
  const res = await handleGetHolidaysByDate(req, { date: "2024-01-26" }, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/market/holidays/2024-01-26")
})

test("handleGetMarketStatus passes exchange param", async () => {
  const fakeData = { status: "success", data: {} }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetMarketStatus } = await import("./market")
  const req = new Request("http://localhost:8081/api/v1/upstox/market/status/NSE")
  const res = await handleGetMarketStatus(req, { exchange: "NSE" }, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/market/status/NSE")
})

// =========================================================================
// Options handlers
// =========================================================================

test("GET /api/v1/upstox/option/chain forwards query", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetOptionChain } = await import("./options")
  const req = new Request("http://localhost:8081/api/v1/upstox/option/chain?instrument_key=NSE_INDEX%7CNifty+50&expiry_date=2024-02-29")
  const res = await handleGetOptionChain(req, mockUpstoxGet)

  expect(res.status).toBe(200)
})

// =========================================================================
// Instruments handler
// =========================================================================

test("GET /api/v1/upstox/instruments/search forwards query", async () => {
  const fakeData = { status: "success", data: [] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleSearchInstruments } = await import("./instruments")
  const req = new Request("http://localhost:8081/api/v1/upstox/instruments/search?search=reliance&exchange=NSE")
  const res = await handleSearchInstruments(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/instruments/search?search=reliance&exchange=NSE")
})

// =========================================================================
// Feed handlers
// =========================================================================

test("GET /api/v1/upstox/feed/market-data-feed/authorize proxies response", async () => {
  const fakeData = { status: "success", data: { authorized_redirect_uri: "wss://example.com" } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleAuthorizeMarketDataFeed } = await import("./feed")
  const req = new Request("http://localhost:8081/api/v1/upstox/feed/market-data-feed/authorize")
  const res = await handleAuthorizeMarketDataFeed(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

// =========================================================================
// Auth handlers (new)
// =========================================================================

test("DELETE /api/v1/upstox/auth/logout calls Upstox-side logout", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxDelete = mock(() => Promise.resolve(fakeResp))

  const { handleUpstoxLogout } = await import("./auth")
  const req = new Request("http://localhost:8081/api/v1/upstox/auth/logout", { method: "DELETE" })
  const res = await handleUpstoxLogout(req, mockUpstoxDelete)

  expect(res.status).toBe(200)
  expect(mockUpstoxDelete).toHaveBeenCalledWith("/logout")
})

test("POST /api/v1/upstox/auth/webhook-token/:client_id calls v3 endpoint", async () => {
  const fakeResp = { status: "success" }
  const mockUpstoxPost = mock(() => Promise.resolve(fakeResp))

  const { handleWebhookToken } = await import("./auth")
  const req = new Request("http://localhost:8081/api/v1/upstox/auth/webhook-token/my_client_id", { method: "POST" })
  const res = await handleWebhookToken(req, { client_id: "my_client_id" }, mockUpstoxPost)

  expect(res.status).toBe(200)
  expect(mockUpstoxPost).toHaveBeenCalledWith("/login/auth/token/request/my_client_id", {}, undefined, { version: 3 })
})

// =========================================================================
// Expired instruments handler
// =========================================================================

test("handleExpiredHistoricalCandle builds correct path", async () => {
  const fakeData = { status: "success", data: { candles: [] } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleExpiredHistoricalCandle } = await import("./expired-instruments")
  const params = { key: "NSE_FO|NIFTY24JAN18000CE", interval: "day", to: "2024-01-25", from: "2024-01-18" }
  const req = new Request("http://localhost:8081/test")
  const res = await handleExpiredHistoricalCandle(req, params, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(mockUpstoxGet).toHaveBeenCalledWith("/expired-instruments/historical-candle/NSE_FO%7CNIFTY24JAN18000CE/day/2024-01-25/2024-01-18")
})

// =========================================================================
// proxyUpstox error handling
// =========================================================================

test("proxyUpstox forwards UpstoxError status and body", async () => {
  const { proxyUpstox } = await import("./_handle")
  const res = await proxyUpstox(() => Promise.reject(new UpstoxError(429, { message: "Rate limited" })))
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: "Rate limited" })
})

test("proxyUpstox returns 500 on unknown error", async () => {
  const { proxyUpstox } = await import("./_handle")
  const res = await proxyUpstox(() => Promise.reject(new Error("Something broke")))
  expect(res.status).toBe(500)
  const body = await res.json() as { error: string }
  expect(body.error).toBe("unknown")
})

// =========================================================================
// forwardQuery helper
// =========================================================================

test("forwardQuery appends query string", async () => {
  const { forwardQuery } = await import("../shared/url")
  const req = new Request("http://localhost:8081/test?a=1&b=2")
  expect(forwardQuery("/path", req)).toBe("/path?a=1&b=2")
})

test("forwardQuery returns path unchanged when no query", async () => {
  const { forwardQuery } = await import("../shared/url")
  const req = new Request("http://localhost:8081/test")
  expect(forwardQuery("/path", req)).toBe("/path")
})
