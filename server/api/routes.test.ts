// server/api/routes.test.ts

// Set env vars before importing auth module
process.env.UPSTOX_CLIENT_ID = "test_client_id"
process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"

import { test, expect, mock } from "bun:test"
import { AuthError, UpstoxError } from "../shared/types"

// --- /api/v1/user/profile ---
test("GET /api/v1/user/profile proxies Upstox response", async () => {
  const fakeData = { status: "success", data: { email: "test@example.com", name: "Test" } }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetProfile } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/user/profile")
  const res = await handleGetProfile(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/user/profile returns 401 when not authenticated", async () => {
  const mockUpstoxGet = mock(() => Promise.reject(new AuthError("not_authenticated", "Visit /auth/login first")))

  const { handleGetProfile } = await import("./user")
  const req = new Request("http://localhost:8081/api/v1/user/profile")
  const res = await handleGetProfile(req, mockUpstoxGet)

  expect(res.status).toBe(401)
  const body = await res.json() as { error: string }
  expect(body.error).toBe("not_authenticated")
})

// --- /api/v1/portfolio/holdings ---
test("GET /api/v1/portfolio/holdings proxies Upstox response", async () => {
  const fakeData = { status: "success", data: [{ isin: "INE002A01018", quantity: 10 }] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetHoldings } = await import("./portfolio")
  const req = new Request("http://localhost:8081/api/v1/portfolio/holdings")
  const res = await handleGetHoldings(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

// --- /api/v1/order/history ---
test("GET /api/v1/order/history proxies Upstox response", async () => {
  const fakeData = { status: "success", data: [{ order_id: "ord_123", status: "complete" }] }
  const mockUpstoxGet = mock(() => Promise.resolve(fakeData))

  const { handleGetOrderHistory } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/order/history")
  const res = await handleGetOrderHistory(req, mockUpstoxGet)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(fakeData)
})

test("GET /api/v1/order/history forwards Upstox error status", async () => {
  const mockUpstoxGet = mock(() => Promise.reject(new UpstoxError(403, { message: "Forbidden" })))

  const { handleGetOrderHistory } = await import("./orders")
  const req = new Request("http://localhost:8081/api/v1/order/history")
  const res = await handleGetOrderHistory(req, mockUpstoxGet)

  expect(res.status).toBe(403)
})
