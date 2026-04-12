// server/modules/auth/index.test.ts
import { test, expect, beforeEach, mock, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { AuthError } from "../../shared/types"

// Set fake env vars before any import of ./index (which imports config)
process.env.UPSTOX_CLIENT_ID = "test_client_id"
process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"

function makeTestDb(): Database {
  const db = new Database(":memory:")
  db.run(`
    CREATE TABLE tokens (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    INTEGER NOT NULL
    )
  `)
  return db
}

// --- buildLoginUrl ---
test("buildLoginUrl returns Upstox authorize URL with required params", async () => {
  const { buildLoginUrl } = await import("./index")
  const url = buildLoginUrl()
  expect(url).toContain("https://api.upstox.com/v2/login/authorization/dialog")
  expect(url).toContain("response_type=code")
  expect(url).toContain("state=")
})

// --- getValidToken ---
test("getValidToken throws AuthError when no token in DB", async () => {
  const { getValidToken } = await import("./index")
  const db = makeTestDb()
  await expect(getValidToken(db)).rejects.toMatchObject({ code: "not_authenticated" })
})

test("getValidToken returns access_token when token is fresh", async () => {
  const { getValidToken } = await import("./index")
  const { upsertToken } = await import("./db")
  const db = makeTestDb()
  const expires_at = Math.floor(Date.now() / 1000) + 3600  // expires in 1h
  upsertToken({ access_token: "fresh_token", refresh_token: "ref", expires_at }, db)
  const token = await getValidToken(db)
  expect(token).toBe("fresh_token")
})

test("getValidToken refreshes when token expires within 5 minutes", async () => {
  const { getValidToken } = await import("./index")
  const { upsertToken } = await import("./db")
  const db = makeTestDb()
  const expires_at = Math.floor(Date.now() / 1000) + 100  // expires in 100s (< 300)
  upsertToken({ access_token: "old_token", refresh_token: "ref_tok", expires_at }, db)

  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ access_token: "new_token", refresh_token: "new_ref", expires_in: 86400 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  const token = await getValidToken(db)
  expect(token).toBe("new_token")
  expect(mockFetch).toHaveBeenCalledTimes(1)

  globalThis.fetch = originalFetch
})

// --- exchangeCode ---
test("exchangeCode stores token and returns access_token on success", async () => {
  process.env.UPSTOX_CLIENT_ID = "test_client_id"
  process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"
  const { exchangeCode } = await import("./index")
  const db = makeTestDb()

  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ access_token: "exc_token", refresh_token: "exc_ref", expires_in: 86400 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  const token = await exchangeCode("auth_code_123", db)
  expect(token).toBe("exc_token")

  // Verify token was persisted
  const { getToken } = await import("./db")
  const stored = getToken(db)
  expect(stored!.access_token).toBe("exc_token")
  expect(stored!.refresh_token).toBe("exc_ref")

  globalThis.fetch = originalFetch
})

test("exchangeCode throws AuthError on Upstox error response", async () => {
  process.env.UPSTOX_CLIENT_ID = "test_client_id"
  process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"
  const { exchangeCode } = await import("./index")
  const db = makeTestDb()

  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: "Invalid code" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  await expect(exchangeCode("bad_code", db)).rejects.toMatchObject({ code: "exchange_failed" })

  globalThis.fetch = originalFetch
})

test("getValidToken throws token_refresh_failed when refresh request fails", async () => {
  const { getValidToken } = await import("./index")
  const { upsertToken } = await import("./db")
  const db = makeTestDb()

  // Token near expiry
  const expires_at = Math.floor(Date.now() / 1000) + 100
  upsertToken({ access_token: "old_tok", refresh_token: "ref_tok", expires_at }, db)

  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  await expect(getValidToken(db)).rejects.toMatchObject({ code: "token_refresh_failed" })

  globalThis.fetch = originalFetch
})
