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
