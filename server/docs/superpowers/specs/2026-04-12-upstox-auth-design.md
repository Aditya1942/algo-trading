# Upstox Auth + Core API Endpoints — Design Spec

**Date:** 2026-04-12  
**Scope:** OAuth2 auth module, token persistence, 3 API endpoints (user profile, holdings, order history)

---

## 1. File Structure

```
server/
  shared/
    db.ts          — SQLite singleton (bun:sqlite)
    upstox.ts      — Upstox HTTP client (upstoxGet<T>)
    config.ts      — env vars (UPSTOX_CLIENT_ID, SECRET, REDIRECT_URI)
    types.ts       — shared types (Token, UpstoxError)
  modules/
    auth/
      index.ts     — getValidToken(), handleLogin(), handleCallback()
      db.ts        — token CRUD (upsert, read row 1)
  api/
    auth.ts        — GET /auth/login, GET /auth/callback
    user.ts        — GET /api/v1/user/profile
    portfolio.ts   — GET /api/v1/portfolio/holdings
    orders.ts      — GET /api/v1/order/history
  index.ts         — Bun.serve() wiring all routes, port 8081
```

---

## 2. DB Schema

```sql
CREATE TABLE IF NOT EXISTS tokens (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER NOT NULL   -- unix epoch seconds
)
```

Single row (id = 1). Single-user personal trading bot. Upsert on every token refresh.

---

## 3. Auth Flow

### Login
- `GET /auth/login`
- Generate random `state` nonce, store in memory
- Build Upstox authorize URL:
  ```
  https://api.upstox.com/v2/login/authorization/dialog
    ?client_id={UPSTOX_CLIENT_ID}
    &redirect_uri={UPSTOX_REDIRECT_URI}
    &response_type=code
    &state={state}
  ```
- Return `302` redirect

### Callback
- `GET /auth/callback?code=xxx&state=xxx`
- Validate `state` matches stored nonce
- POST to `https://api.upstox.com/v2/login/authorization/token` with:
  - `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`
  - Content-Type: `application/x-www-form-urlencoded`
- Parse response: `access_token`, `refresh_token`, `expires_in` (seconds)
- Compute `expires_at = now + expires_in`
- Upsert into `tokens` table (row id=1)
- Return `200 { success: true, user: <email from token response if present> }`

### Token Refresh
- `getValidToken()` in `modules/auth/index.ts`:
  1. Read row 1 from `tokens`
  2. If `expires_at - Date.now()/1000 < 300` (5 min buffer): refresh
  3. POST to `https://api.upstox.com/v2/login/authorization/token` with `grant_type=refresh_token`
  4. Upsert new tokens
  5. Return valid `access_token`
- If no row exists: throw `AuthError("not_authenticated")`

---

## 4. Shared Upstox Client

`shared/upstox.ts`:

```typescript
async function upstoxGet<T>(path: string): Promise<T>
```

- Calls `getValidToken()` first
- Sets `Authorization: Bearer <token>`, `Accept: application/json`
- Hits `https://api.upstox.com/v2{path}`
- On non-2xx: throws `UpstoxError` with status + body

---

## 5. API Endpoints

All JSON routes under `/api/v1/`. No token logic in route handlers — all auth via `upstoxGet`.

| Route | Upstox endpoint | Notes |
|---|---|---|
| `GET /api/v1/user/profile` | `GET /v2/user/profile` | Pass through response as-is |
| `GET /api/v1/portfolio/holdings` | `GET /v2/portfolio/long-term-holdings` | Pass through |
| `GET /api/v1/order/history` | `GET /v2/order/history` | Pass through |

---

## 6. Error Handling

| Scenario | Response |
|---|---|
| No token in DB | `401 { error: "not_authenticated", message: "Visit /auth/login first" }` |
| Upstox API error | Forward Upstox status code + body as-is |
| State mismatch on callback | `400 { error: "invalid_state" }` |
| Token refresh fails | `401 { error: "token_refresh_failed" }` |

---

## 7. Environment Variables

```env
UPSTOX_CLIENT_ID=
UPSTOX_CLIENT_SECRET=
UPSTOX_REDIRECT_URI=http://localhost:8081/auth/callback
```

Loaded automatically by Bun from `.env`. Accessed via `shared/config.ts`.
