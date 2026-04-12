# Upstox Auth + Core API Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Upstox OAuth2 auth with SQLite token persistence and 3 read-only API endpoints (user profile, holdings, order history).

**Architecture:** Auth module owns token lifecycle (login redirect, callback exchange, auto-refresh). `shared/upstox.ts` calls `getValidToken()` before every HTTP request. Thin API route handlers proxy Upstox responses without transformation. Routes wired into `Bun.serve()` in `index.ts` on port 8081.

**Tech Stack:** Bun, bun:sqlite, bun:test, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/shared/types.ts` | Create | `Token`, `AuthError`, `UpstoxError` types |
| `server/shared/config.ts` | Create | Env var accessors |
| `server/shared/db.ts` | Create | SQLite singleton + schema init |
| `server/modules/auth/db.ts` | Create | Token CRUD (getToken, upsertToken) |
| `server/modules/auth/index.ts` | Create | buildLoginUrl, exchangeCode, getValidToken |
| `server/shared/upstox.ts` | Create | upstoxGet<T> — authenticated HTTP client |
| `server/api/auth.ts` | Create | GET /auth/login, GET /auth/callback handlers |
| `server/api/user.ts` | Create | GET /api/v1/user/profile handler |
| `server/api/portfolio.ts` | Create | GET /api/v1/portfolio/holdings handler |
| `server/api/orders.ts` | Create | GET /api/v1/order/history handler |
| `server/index.ts` | Modify | Wire all routes, change port to 8081 |

---

### Task 1: Foundation — types, config, db singleton

**Files:**
- Create: `server/shared/types.ts`
- Create: `server/shared/config.ts`
- Create: `server/shared/db.ts`

No tests needed — pure types, env accessors, schema init.

- [ ] **Step 1: Create shared/types.ts**

```typescript
// server/shared/types.ts

export interface Token {
  id: number
  access_token: string
  refresh_token: string | null
  expires_at: number  // unix epoch seconds
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = "AuthError"
  }
}

export class UpstoxError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Upstox API error ${status}`)
    this.name = "UpstoxError"
  }
}
```

- [ ] **Step 2: Create shared/config.ts**

```typescript
// server/shared/config.ts

export const config = {
  upstoxClientId: process.env.UPSTOX_CLIENT_ID ?? "",
  upstoxClientSecret: process.env.UPSTOX_CLIENT_SECRET ?? "",
  upstoxRedirectUri: process.env.UPSTOX_REDIRECT_URI ?? "http://localhost:8081/auth/callback",
  port: 8081,
} as const
```

- [ ] **Step 3: Create shared/db.ts**

```typescript
// server/shared/db.ts
import { Database } from "bun:sqlite"

const db = new Database("algo.db")

db.run(`
  CREATE TABLE IF NOT EXISTS tokens (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    INTEGER NOT NULL
  )
`)

export default db
```

- [ ] **Step 4: Commit**

```bash
git add server/shared/types.ts server/shared/config.ts server/shared/db.ts
git commit -m "feat: add shared types, config, and db singleton"
```

---

### Task 2: Token CRUD — modules/auth/db.ts

**Files:**
- Create: `server/modules/auth/db.ts`
- Create: `server/modules/auth/db.test.ts`

Functions accept an optional `db` param (defaults to singleton) so tests can pass an in-memory DB.

- [ ] **Step 1: Write failing tests**

```typescript
// server/modules/auth/db.test.ts
import { test, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { getToken, upsertToken } from "./db"

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

let db: Database

beforeEach(() => {
  db = makeTestDb()
})

test("getToken returns null when no token stored", () => {
  expect(getToken(db)).toBeNull()
})

test("upsertToken stores token and getToken retrieves it", () => {
  upsertToken({ access_token: "tok_abc", refresh_token: "ref_xyz", expires_at: 9999999 }, db)
  const t = getToken(db)
  expect(t).not.toBeNull()
  expect(t!.access_token).toBe("tok_abc")
  expect(t!.refresh_token).toBe("ref_xyz")
  expect(t!.expires_at).toBe(9999999)
})

test("upsertToken overwrites existing token", () => {
  upsertToken({ access_token: "tok_old", refresh_token: null, expires_at: 1000 }, db)
  upsertToken({ access_token: "tok_new", refresh_token: "ref_new", expires_at: 2000 }, db)
  const t = getToken(db)
  expect(t!.access_token).toBe("tok_new")
  expect(t!.expires_at).toBe(2000)
})

test("upsertToken handles null refresh_token", () => {
  upsertToken({ access_token: "tok", refresh_token: null, expires_at: 5000 }, db)
  const t = getToken(db)
  expect(t!.refresh_token).toBeNull()
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && bun test modules/auth/db.test.ts
```

Expected: `Cannot find module './db'`

- [ ] **Step 3: Implement modules/auth/db.ts**

```typescript
// server/modules/auth/db.ts
import { Database } from "bun:sqlite"
import _db from "../../shared/db"
import type { Token } from "../../shared/types"

export function getToken(db: Database = _db): Token | null {
  return db.query("SELECT * FROM tokens WHERE id = 1").get() as Token | null
}

export function upsertToken(token: Omit<Token, "id">, db: Database = _db): void {
  db.run(
    `INSERT INTO tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at    = excluded.expires_at`,
    [token.access_token, token.refresh_token ?? null, token.expires_at]
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && bun test modules/auth/db.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/modules/auth/db.ts server/modules/auth/db.test.ts
git commit -m "feat: add token CRUD for auth module"
```

---

### Task 3: Auth logic — modules/auth/index.ts

**Files:**
- Create: `server/modules/auth/index.ts`
- Create: `server/modules/auth/index.test.ts`

Three exports: `buildLoginUrl()`, `exchangeCode()`, `getValidToken()`.
State nonce stored in a module-level `Map<string, number>` (timestamp for expiry).

- [ ] **Step 1: Write failing tests**

```typescript
// server/modules/auth/index.test.ts
import { test, expect, beforeEach, mock, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { AuthError } from "../../shared/types"

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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && bun test modules/auth/index.test.ts
```

Expected: `Cannot find module './index'`

- [ ] **Step 3: Implement modules/auth/index.ts**

```typescript
// server/modules/auth/index.ts
import { Database } from "bun:sqlite"
import { config } from "../../shared/config"
import { AuthError } from "../../shared/types"
import { getToken, upsertToken } from "./db"
import _db from "../../shared/db"

// In-memory state nonce store: state -> timestamp created
const stateStore = new Map<string, number>()
const STATE_TTL_MS = 10 * 60 * 1000  // 10 minutes

export function buildLoginUrl(): string {
  const state = crypto.randomUUID()
  stateStore.set(state, Date.now())
  const params = new URLSearchParams({
    client_id: config.upstoxClientId,
    redirect_uri: config.upstoxRedirectUri,
    response_type: "code",
    state,
  })
  return `https://api.upstox.com/v2/login/authorization/dialog?${params}`
}

export function consumeState(state: string): boolean {
  const ts = stateStore.get(state)
  if (!ts) return false
  stateStore.delete(state)
  if (Date.now() - ts > STATE_TTL_MS) return false
  return true
}

export async function exchangeCode(code: string, db: Database = _db): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.upstoxClientId,
    client_secret: config.upstoxClientSecret,
    redirect_uri: config.upstoxRedirectUri,
    grant_type: "authorization_code",
  })
  const res = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new AuthError("exchange_failed", JSON.stringify(errBody))
  }
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  upsertToken(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
    db
  )
  return data.access_token
}

export async function getValidToken(db: Database = _db): Promise<string> {
  const token = getToken(db)
  if (!token) throw new AuthError("not_authenticated", "Visit /auth/login first")

  const nowSec = Math.floor(Date.now() / 1000)
  if (token.expires_at - nowSec > 300) return token.access_token

  // Refresh
  if (!token.refresh_token) throw new AuthError("not_authenticated", "No refresh token — re-authenticate")

  const body = new URLSearchParams({
    refresh_token: token.refresh_token,
    client_id: config.upstoxClientId,
    client_secret: config.upstoxClientSecret,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) throw new AuthError("token_refresh_failed", "Token refresh failed")

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  upsertToken(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
    db
  )
  return data.access_token
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && bun test modules/auth/index.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/modules/auth/index.ts server/modules/auth/index.test.ts
git commit -m "feat: add auth logic — login URL, code exchange, token refresh"
```

---

### Task 4: Shared Upstox HTTP client — shared/upstox.ts

**Files:**
- Create: `server/shared/upstox.ts`
- Create: `server/shared/upstox.test.ts`

Single `upstoxGet<T>(path)` function. Calls `getValidToken()`, sets auth header, forwards Upstox errors.

- [ ] **Step 1: Write failing tests**

```typescript
// server/shared/upstox.test.ts
import { test, expect, mock } from "bun:test"
import { UpstoxError } from "./types"

test("upstoxGet returns parsed JSON on success", async () => {
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { name: "Test User" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const mockGetValidToken = mock(() => Promise.resolve("test_access_token"))

  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  // Dynamic import after mocking
  const { upstoxGet } = await import("./upstox")
  const result = await upstoxGet("/user/profile", mockGetValidToken)

  expect(result).toEqual({ data: { name: "Test User" } })
  expect(mockFetch).toHaveBeenCalledTimes(1)
  const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
  expect(callArgs[0]).toBe("https://api.upstox.com/v2/user/profile")
  expect((callArgs[1]?.headers as Record<string, string>)["Authorization"]).toBe("Bearer test_access_token")

  globalThis.fetch = originalFetch
})

test("upstoxGet throws UpstoxError on non-2xx response", async () => {
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const mockGetValidToken = mock(() => Promise.resolve("bad_token"))
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  const { upstoxGet } = await import("./upstox")

  await expect(upstoxGet("/user/profile", mockGetValidToken)).rejects.toBeInstanceOf(UpstoxError)

  globalThis.fetch = originalFetch
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && bun test shared/upstox.test.ts
```

Expected: `Cannot find module './upstox'`

- [ ] **Step 3: Implement shared/upstox.ts**

```typescript
// server/shared/upstox.ts
import { UpstoxError } from "./types"
import { getValidToken as _getValidToken } from "../modules/auth/index"

const BASE_URL = "https://api.upstox.com/v2"

export async function upstoxGet<T>(
  path: string,
  getToken: () => Promise<string> = _getValidToken
): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new UpstoxError(res.status, body)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && bun test shared/upstox.test.ts
```

Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/shared/upstox.ts server/shared/upstox.test.ts
git commit -m "feat: add shared Upstox HTTP client"
```

---

### Task 5: Auth route handlers — api/auth.ts

**Files:**
- Create: `server/api/auth.ts`

Handles `GET /auth/login` (redirect) and `GET /auth/callback` (token exchange → JSON).

No unit tests here — handlers are thin wiring. Tested manually in Task 7.

- [ ] **Step 1: Create api/auth.ts**

```typescript
// server/api/auth.ts
import { buildLoginUrl, consumeState, exchangeCode } from "../modules/auth/index"
import { AuthError } from "../shared/types"

export async function handleLogin(_req: Request): Promise<Response> {
  const url = buildLoginUrl()
  return Response.redirect(url, 302)
}

export async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    return Response.json({ error: "missing_params" }, { status: 400 })
  }
  if (!consumeState(state)) {
    return Response.json({ error: "invalid_state" }, { status: 400 })
  }
  try {
    await exchangeCode(code)
    return Response.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/api/auth.ts
git commit -m "feat: add auth route handlers (login redirect, callback)"
```

---

### Task 6: API route handlers — user, portfolio, orders

**Files:**
- Create: `server/api/user.ts`
- Create: `server/api/portfolio.ts`
- Create: `server/api/orders.ts`
- Create: `server/api/routes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// server/api/routes.test.ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && bun test api/routes.test.ts
```

Expected: `Cannot find module './user'`

- [ ] **Step 3: Implement api/user.ts**

```typescript
// server/api/user.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { AuthError, UpstoxError } from "../shared/types"

export async function handleGetProfile(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const data = await upstoxGet("/user/profile")
    return Response.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    if (err instanceof UpstoxError) {
      return Response.json(err.body, { status: err.status })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement api/portfolio.ts**

```typescript
// server/api/portfolio.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { AuthError, UpstoxError } from "../shared/types"

export async function handleGetHoldings(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const data = await upstoxGet("/portfolio/long-term-holdings")
    return Response.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    if (err instanceof UpstoxError) {
      return Response.json(err.body, { status: err.status })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Implement api/orders.ts**

```typescript
// server/api/orders.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { AuthError, UpstoxError } from "../shared/types"

export async function handleGetOrderHistory(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const data = await upstoxGet("/order/history")
    return Response.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    if (err instanceof UpstoxError) {
      return Response.json(err.body, { status: err.status })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd server && bun test api/routes.test.ts
```

Expected: 4 tests pass

- [ ] **Step 7: Commit**

```bash
git add server/api/user.ts server/api/portfolio.ts server/api/orders.ts server/api/routes.test.ts
git commit -m "feat: add user profile, holdings, order history API handlers"
```

---

### Task 7: Wire everything in index.ts

**Files:**
- Modify: `server/index.ts`

Replace the existing minimal server with all routes wired up on port 8081.

- [ ] **Step 1: Replace server/index.ts**

```typescript
// server/index.ts
import { config } from "./shared/config"
import { handleLogin, handleCallback } from "./api/auth"
import { handleGetProfile } from "./api/user"
import { handleGetHoldings } from "./api/portfolio"
import { handleGetOrderHistory } from "./api/orders"

Bun.serve({
  port: config.port,
  routes: {
    // Auth (root — no /api/v1/ prefix, Upstox redirect URI must match)
    "/auth/login":    { GET: handleLogin },
    "/auth/callback": { GET: handleCallback },

    // API v1
    "/api/v1/user/profile":        { GET: handleGetProfile },
    "/api/v1/portfolio/holdings":  { GET: handleGetHoldings },
    "/api/v1/order/history":       { GET: handleGetOrderHistory },

    // Health (keep for infra checks)
    "/api/v1/health": {
      GET: () => Response.json({ healthy: true }),
    },
  },
})

console.log(`Server running on http://localhost:${config.port}`)
```

- [ ] **Step 2: Start server and verify routes exist**

```bash
cd server && bun --hot run index.ts
```

Expected: `Server running on http://localhost:8081`

- [ ] **Step 3: Smoke test unauthenticated API routes**

```bash
curl -s http://localhost:8081/api/v1/user/profile | jq .
```

Expected:
```json
{ "error": "not_authenticated", "message": "Visit /auth/login first" }
```

```bash
curl -s http://localhost:8081/api/v1/portfolio/holdings | jq .
curl -s http://localhost:8081/api/v1/order/history | jq .
```

Both should return same 401 response.

- [ ] **Step 4: Smoke test login redirect**

```bash
curl -v http://localhost:8081/auth/login 2>&1 | grep "Location:"
```

Expected: `Location:` header pointing to `https://api.upstox.com/v2/login/authorization/dialog?...`

- [ ] **Step 5: Run all tests**

```bash
cd server && bun test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add server/index.ts
git commit -m "feat: wire all routes into Bun.serve on port 8081"
```

---

## End State

After all tasks complete:

| Route | Behavior |
|---|---|
| `GET /auth/login` | 302 → Upstox authorize URL |
| `GET /auth/callback?code=&state=` | Exchanges code, stores token, returns `{ success: true }` |
| `GET /api/v1/user/profile` | Upstox user profile (401 if no token) |
| `GET /api/v1/portfolio/holdings` | Upstox long-term holdings (401 if no token) |
| `GET /api/v1/order/history` | Upstox order history (401 if no token) |
| `GET /api/v1/health` | `{ healthy: true }` |

**To authenticate:** Open `http://localhost:8081/auth/login` in browser. Token persists in SQLite, auto-refreshes on expiry.
