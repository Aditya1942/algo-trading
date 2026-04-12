# Upstox API — reference for agents

Condensed from official docs (see [sources](#sources)). Use this when implementing or reasoning about Upstox REST calls; always verify behavior against live responses.

---

## Base request pattern

```http
[METHOD] https://api.upstox.com/v2/[path]
```

- **Auth:** `Authorization: Bearer <access_token>`
- **Accept:** `application/json` (required for JSON responses)
- **Body:** For POST/PUT with JSON, add `Content-Type: application/json` and `-d '<json>'`. For form data, use `Content-Type: application/x-www-form-urlencoded`.
- **Encoding:** Use standard URL encoding for query strings and path segments (percent-encoding for special/non-ASCII characters).

Some endpoints use **v3** under the same host (see [Get funds and margin v3](#get-funds-and-margin-v3)).

---

## Response envelope

### Success — single object

Used when the API returns one object (e.g. `/user/profile`, `/order/place`).

```json
{
  "status": "success",
  "data": { }
}
```

### Success — multiple objects

Used when the API returns an array (e.g. older “get funds and margin” style responses).

```json
{
  "status": "success",
  "data": [ { }, { } ]
}
```

| Field   | Meaning |
|--------|---------|
| `status` | Usually `"success"` for OK. |
| `data`   | Object or array of objects — endpoint-specific. |

### Error

```json
{
  "status": "error",
  "errors": [
    {
      "error_code": "string",
      "message": "string",
      "property_path": null,
      "invalid_value": null
    }
  ]
}
```

| Field            | Meaning |
|------------------|---------|
| `status`         | `"error"`. |
| `errors`         | Array of error objects. |
| `error_code`     | Application error code (see [Error codes](#error-codes)). |
| `message`        | Human-readable description. |
| `property_path`  | Request field that caused the error, if applicable; may be null. |
| `invalid_value`  | Offending value; may be null. |

**Deprecation:** camelCase fields (`errorCode`, `propertyPath`, `invalidValue`) are deprecated; prefer **snake_case** in new code.

---

## HTTP status codes (common)

| Code | Meaning |
|------|---------|
| 400 | Bad request — parameters wrong. |
| 401 | Unauthorized — API key missing/wrong or token invalid. |
| 403 | Forbidden — resource restricted. |
| 404 | Not found. |
| 405 | Method not allowed. |
| 406 | Not Acceptable — non-JSON format requested. |
| 410 | Gone — resource removed. |
| 429 | Too many requests — back off and retry with delay. |
| 500 | Server error — retry later. |
| 503 | Service unavailable — maintenance; retry later. |

---

## Common application error codes

| Code        | Typical cause |
|-------------|----------------|
| UDAPI10000  | Unsupported or malformed API call (bad URL, unexpected characters). |
| UDAPI100016 | Invalid credentials. |
| UDAPI10005  | Rate limit exceeded. |
| UDAPI100015 | API version missing from headers where required. |
| UDAPI100050 | Invalid token. |
| UDAPI100067 | Endpoint not allowed with `extended_token`. |
| UDAPI100036 / UDAPI100038 | Invalid input. |
| UDAPI100073 | `client_id` inactive — support contact. |
| UDAPI100500 | Generic server-side failure — support. |

Per-endpoint 4xx details appear in each API’s documentation.

---

## Rate limiting

Limits apply **per API, per user**.

**Order placement APIs** (place, modify, cancel, multi order, GTT):

| Window      | Regular algos (no SEBI registration) | SEBI-registered algos |
|-------------|--------------------------------------|-------------------------|
| Per second  | 10                                   | 50                      |
| Per minute  | 500                                  | 500                     |
| Per 30 min  | 2000                                 | 2000                    |

**Other standard APIs** (holdings, positions, funds, historical candles, etc.):

| Window      | Limit   |
|-------------|---------|
| Per second  | 50      |
| Per minute  | 500     |
| Per 30 min  | 2000    |

Exceeding limits can cause **temporary suspension**. Agents should implement **exponential backoff** on `429` and on `UDAPI10005`, and throttle proactively to stay under per-second caps.

---

## User APIs (subset)

### Get profile

- **Purpose:** Profile, enabled exchanges, products, order types, broker, account flags.
- **Method / URL:** `GET https://api.upstox.com/v2/user/profile`
- **Headers:** `Authorization: Bearer <token>`, `Accept: application/json`, `Content-Type: application/json` (as in official curl sample).

**Example success `data` fields:**

| Field          | Type     | Notes |
|----------------|----------|--------|
| `email`        | string   | May be masked in docs. |
| `exchanges`    | string[] | e.g. NSE, NFO, BSE, CDS, BFO, BCD — see Exchange appendix in Upstox docs. |
| `products`     | string[] | e.g. `I`, `D`, `CO`, `MTF`. |
| `broker`       | string   | e.g. `UPSTOX`. |
| `user_id`      | string   | UCC-style identifier. |
| `user_name`    | string   | |
| `order_types`  | string[] | e.g. MARKET, LIMIT, SL, SL-M. |
| `user_type`    | string   | e.g. `individual` for retail. |
| `poa`          | boolean  | Power of attorney. |
| `ddpi`         | boolean  | DDPI authorization. |
| `is_active`    | boolean  | Account active. |

---

### Get funds and margin v3

- **Purpose:** Cash vs pledge breakdown; **available_to_trade** vs **unavailable_to_trade** (unsettled P&L, blocked pledge, etc.).
- **Method / URL:** `GET https://api.upstox.com/v3/user/get-funds-and-margin`
- **Headers:** `Authorization: Bearer <token>`, `Accept: application/json`, **`Api-Version: 3.0`** (required for v3).

**Top-level `data`:**

- `available_to_trade` — `total`, `cash_available_to_trade`, `pledge_available_to_trade` (each with nested `cash` / `margin_from_pledge` and `margin_used` breakdowns including SPAN, VAR/ELM, delivery margin, MTF, realised/unrealised loss, etc.).
- `unavailable_to_trade` — `cash_unavailable_to_trade` (e.g. `unsettled_profit`), `pledge_unavailable_to_trade` (equity / mutual funds not usable).

Use the official field tables for precise meanings of each float (opening balance, added_today, premium_present, etc.).

---

## Agent implementation checklist

1. Parse **`status`** first; on `"error"`, read **`errors[]`** and **`error_code`** / **`message`**.
2. Prefer **snake_case** error fields; do not rely on deprecated camelCase.
3. Send **`Api-Version: 3.0`** only for APIs that document it (e.g. funds v3).
4. Respect **rate limits** by endpoint class (orders vs standard); treat **429** and **UDAPI10005** as throttle signals.
5. Use **URL-encoded** queries and paths.
6. For OAuth, obtain and refresh **access tokens** per Upstox auth flow (not covered here).

---

## Sources

Official Upstox Developer API (retrieved for compilation of this doc):

| Topic | URL |
|-------|-----|
| Request/response hub | https://upstox.com/developer/api-documentation/request-response |
| Request structure | https://upstox.com/developer/api-documentation/request-structure |
| Response structure | https://upstox.com/developer/api-documentation/response-structure |
| Error codes | https://upstox.com/developer/api-documentation/error-codes |
| Rate limiting | https://upstox.com/developer/api-documentation/rate-limiting |
| User (index) | https://upstox.com/developer/api-documentation/user |
| Get profile | https://upstox.com/developer/api-documentation/get-profile |
| Get funds and margin v3 | https://upstox.com/developer/api-documentation/get-funds-and-margin-v3 |
