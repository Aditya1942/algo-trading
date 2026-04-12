# Upstox API — reference for agents

Condensed from official docs (see [sources](#sources)). Use this when implementing or reasoning about Upstox REST calls; always verify behavior against live responses.

**Canonical machine-readable list:** OpenAPI 3.1 at [https://api.upstox.com/v2/api-docs](https://api.upstox.com/v2/api-docs) (same payload the [self-generated SDK](https://upstox.com/developer/api-documentation/self-generated-sdk) uses). Interactive UI: [Swagger UI](https://api.upstox.com/v2/swagger-ui/index.html). The **REST catalog** below is derived from that spec so **no published REST operation is omitted**.

---

## Base URLs


| Host                         | Role                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://api.upstox.com`     | Primary REST host (used in this repo and most docs).                                                                                                                   |
| `https://api-v2.upstox.com`  | Alternate host listed in OpenAPI `servers`; same API surface as `api.upstox.com` in practice.                                                                          |
| `https://api-hft.upstox.com` | Optional host for **order** place / modify / cancel for lower latency — see [announcement](https://upstox.com/developer/api-documentation/announcements/enhanced-url). |


Paths are versioned: `**/v2/...`** and `**/v3/...**` (not only `/v2/` under the hostname).

Example: `GET https://api.upstox.com/v2/user/profile`, `GET https://api.upstox.com/v3/user/get-funds-and-margin`.

---

## Request pattern

```http
[METHOD] https://api.upstox.com[/{v2|v3}]/[path]
```

- **Auth:** `Authorization: Bearer <access_token>`
- **Accept:** `application/json` (required for JSON responses)
- **Body:** For POST/PUT with JSON, add `Content-Type: application/json`. For form data, use `Content-Type: application/x-www-form-urlencoded`.
- **Encoding:** URL-encode query strings and path segments.
- **Version header:** Some **v3** APIs require `Api-Version: 3.0` (e.g. [Get funds and margin v3](#user) — confirm per endpoint in Swagger or the linked doc page).

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

Used when the API returns an array.

```json
{
  "status": "success",
  "data": [ { }, { } ]
}
```


| Field    | Meaning                                         |
| -------- | ----------------------------------------------- |
| `status` | Usually `"success"` for OK.                     |
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


| Field           | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| `status`        | `"error"`.                                                                   |
| `errors`        | Array of error objects.                                                      |
| `error_code`    | Application error code (see [Error codes](#common-application-error-codes)). |
| `message`       | Human-readable description.                                                  |
| `property_path` | Request field that caused the error, if applicable; may be null.             |
| `invalid_value` | Offending value; may be null.                                                |


**Deprecation:** camelCase fields (`errorCode`, `propertyPath`, `invalidValue`) are deprecated; prefer **snake_case** in new code.

---

## HTTP status codes (common)


| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 400  | Bad request — parameters wrong.                        |
| 401  | Unauthorized — API key missing/wrong or token invalid. |
| 403  | Forbidden — resource restricted.                       |
| 404  | Not found.                                             |
| 405  | Method not allowed.                                    |
| 406  | Not Acceptable — non-JSON format requested.            |
| 410  | Gone — resource removed.                               |
| 429  | Too many requests — back off and retry with delay.     |
| 500  | Server error — retry later.                            |
| 503  | Service unavailable — maintenance; retry later.        |


---

## Common application error codes


| Code                      | Typical cause                                                       |
| ------------------------- | ------------------------------------------------------------------- |
| UDAPI10000                | Unsupported or malformed API call (bad URL, unexpected characters). |
| UDAPI100016               | Invalid credentials.                                                |
| UDAPI10005                | Rate limit exceeded.                                                |
| UDAPI100015               | API version missing from headers where required.                    |
| UDAPI100050               | Invalid token.                                                      |
| UDAPI100067               | Endpoint not allowed with `extended_token`.                         |
| UDAPI100036 / UDAPI100038 | Invalid input.                                                      |
| UDAPI100073               | `client_id` inactive — support contact.                             |
| UDAPI100500               | Generic server-side failure — support.                              |


Per-endpoint 4xx details appear in each API’s documentation.

---

## Rate limiting

Limits apply **per API, per user**.

**Order placement APIs** (place, modify, cancel, multi order, GTT):


| Window     | Regular algos (no SEBI registration) | SEBI-registered algos |
| ---------- | ------------------------------------ | --------------------- |
| Per second | 10                                   | 50                    |
| Per minute | 500                                  | 500                   |
| Per 30 min | 2000                                 | 2000                  |


**Other standard APIs** (holdings, positions, funds, historical candles, etc.):


| Window     | Limit |
| ---------- | ----- |
| Per second | 50    |
| Per minute | 500   |
| Per 30 min | 2000  |


Exceeding limits can cause **temporary suspension**. Agents should implement **exponential backoff** on `429` and on `UDAPI10005`, and throttle proactively to stay under per-second caps.

---

## OpenAPI metadata


| Item                     | Notes                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Operation count**      | **66** HTTP operations in `https://api.upstox.com/v2/api-docs` (paths × methods).                                              |
| **Tag: Pre Risk Checks** | Appears in OpenAPI `tags` but **no operation** uses it in the current spec — treat as unused until an operation references it. |


---

## Developer API hub (topics from [Open API](https://upstox.com/developer/api-documentation/open-api))

These are documented on the portal alongside REST; not all are single REST routes.


| Topic                                      | Doc                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sandbox                                    | [Sandbox](https://upstox.com/developer/api-documentation/sandbox), [Build using sandbox](https://upstox.com/developer/api-documentation/build-using-sandbox)                                                                                                                                                                         |
| Authentication (OAuth 2.0)                 | [Authentication](https://upstox.com/developer/api-documentation/authentication)                                                                                                                                                                                                                                                      |
| API structure (request/response)           | [Request–response hub](https://upstox.com/developer/api-documentation/request-response), [Request structure](https://upstox.com/developer/api-documentation/request-structure), [Response structure](https://upstox.com/developer/api-documentation/response-structure)                                                              |
| Rate limits                                | [Rate limiting](https://upstox.com/developer/api-documentation/rate-limiting)                                                                                                                                                                                                                                                        |
| SDK                                        | [SDK](https://upstox.com/developer/api-documentation/sdk), [Installing SDK](https://upstox.com/developer/api-documentation/installing-sdk), [Self-generated SDK](https://upstox.com/developer/api-documentation/self-generated-sdk), [OpenAPI definition (human)](https://upstox.com/developer/api-documentation/openapi-definition) |
| MCP                                        | [MCP integration](https://upstox.com/developer/api-documentation/mcp-integration)                                                                                                                                                                                                                                                    |
| Instruments (files, BOD/MTF/MIS JSON)      | [Instruments](https://upstox.com/developer/api-documentation/instruments)                                                                                                                                                                                                                                                            |
| Expired instruments (overview)             | [Expired instruments](https://upstox.com/developer/api-documentation/expired-instruments)                                                                                                                                                                                                                                            |
| WebSocket (streaming)                      | [Streamer functions](https://upstox.com/developer/api-documentation/streamer-function), [Websocket implementation](https://upstox.com/developer/api-documentation/websocket-implementation), [Sample implementation](https://upstox.com/developer/api-documentation/sample-implementation)                                           |
| Webhook                                    | [Webhook](https://upstox.com/developer/api-documentation/webhook)                                                                                                                                                                                                                                                                    |
| Analytics token (read-only access pattern) | [Analytics token](https://upstox.com/developer/api-documentation/analytics-token)                                                                                                                                                                                                                                                    |
| Appendix / enums / Postman                 | [Appendix index via changelog & related](https://upstox.com/developer/api-documentation/appendix/change-log), [Postman collection](https://upstox.com/developer/api-documentation/appendix/postman-collection)                                                                                                                       |


---

## REST API catalog (complete — OpenAPI)

Full URL pattern: `https://api.upstox.com` + **path** (path already includes `/v2` or `/v3`). **Doc** links go to the matching page in the [developer API reference](https://upstox.com/developer/api-documentation/open-api) where one exists.

### Login


| Method | Path                                       | Summary                                                    | Doc                                                                                             |
| ------ | ------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/v2/login/authorization/dialog`           | OAuth authorization dialog (browser redirect).             | [Authorize API](https://upstox.com/developer/api-documentation/authorize)                       |
| POST   | `/v2/login/authorization/token`            | Exchange code / refresh token for access token.            | [Get token API](https://upstox.com/developer/api-documentation/get-token)                       |
| DELETE | `/v2/logout`                               | Log out / invalidate session.                              | [Logout API](https://upstox.com/developer/api-documentation/logout)                             |
| POST   | `/v3/login/auth/token/request/{client_id}` | Initiate token request flow (webhook-based user approval). | [Access token request API](https://upstox.com/developer/api-documentation/access-token-request) |


### User


| Method | Path                            | Summary                                         | Doc                                                                                               |
| ------ | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/v2/user/profile`              | User profile, exchanges, products, order types. | [Get profile](https://upstox.com/developer/api-documentation/get-profile)                         |
| GET    | `/v2/user/get-funds-and-margin` | Funds and margin (v2 shape).                    | [Get fund and margin](https://upstox.com/developer/api-documentation/get-user-fund-margin)        |
| GET    | `/v3/user/get-funds-and-margin` | Funds and margin (v3 breakdown).                | [Get funds and margin v3](https://upstox.com/developer/api-documentation/get-funds-and-margin-v3) |
| GET    | `/v2/user/ip`                   | Static IP configuration for the app.            | [Get static IPs](https://upstox.com/developer/api-documentation/get-app-static-ips)               |
| PUT    | `/v2/user/ip`                   | Update static IPs (may invalidate token).       | [Update static IPs](https://upstox.com/developer/api-documentation/update-app-static-ips)         |
| GET    | `/v2/user/kill-switch`          | Kill switch status per segment.                 | [Kill switch status](https://upstox.com/developer/api-documentation/get-kill-switch)              |
| POST   | `/v2/user/kill-switch`          | Update kill switch.                             | [Kill switch](https://upstox.com/developer/api-documentation/update-kill-switch)                  |


### Charge and margin


| Method | Path                            | Summary                                           | Doc                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/v2/charges/brokerage`         | Brokerage for an order context.                   | [Brokerage details](https://upstox.com/developer/api-documentation/get-brokerage)         |
| GET    | `/v2/charges/historical-trades` | Historical trades (post-trade / charges context). | [Get trade history](https://upstox.com/developer/api-documentation/get-historical-trades) |
| POST   | `/v2/charges/margin`            | Margin calculation before order placement.        | [Margin details](https://upstox.com/developer/api-documentation/margin)                   |


### Order (v2 and v3)


| Method | Path                                  | Summary                                | Doc                                                                                     |
| ------ | ------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/v2/order/place`                     | Place order (v2).                      | [Place order](https://upstox.com/developer/api-documentation/place-order)               |
| POST   | `/v3/order/place`                     | Place order (v3).                      | [Place order v3](https://upstox.com/developer/api-documentation/place-order-v3)         |
| PUT    | `/v2/order/modify`                    | Modify order (v2).                     | [Modify order](https://upstox.com/developer/api-documentation/modify-order)             |
| PUT    | `/v3/order/modify`                    | Modify order (v3).                     | [Modify order v3](https://upstox.com/developer/api-documentation/modify-order-v3)       |
| DELETE | `/v2/order/cancel`                    | Cancel order (v2).                     | [Cancel order](https://upstox.com/developer/api-documentation/cancel-order)             |
| DELETE | `/v3/order/cancel`                    | Cancel order (v3).                     | [Cancel order v3](https://upstox.com/developer/api-documentation/cancel-order-v3)       |
| GET    | `/v2/order/retrieve-all`              | Order book (day).                      | [Get order book](https://upstox.com/developer/api-documentation/get-order-book)         |
| GET    | `/v2/order/details`                   | Single order details.                  | [Get order details](https://upstox.com/developer/api-documentation/get-order-details)   |
| GET    | `/v2/order/history`                   | Order state history.                   | [Get order history](https://upstox.com/developer/api-documentation/get-order-history)   |
| GET    | `/v2/order/trades`                    | Trades for an order.                   | [Get order trades](https://upstox.com/developer/api-documentation/get-trades-by-order)  |
| GET    | `/v2/order/trades/get-trades-for-day` | All trades for the day.                | [Get trades](https://upstox.com/developer/api-documentation/get-trade-history)          |
| POST   | `/v2/order/multi/place`               | Place multiple orders.                 | [Place multi order](https://upstox.com/developer/api-documentation/place-multi-order)   |
| DELETE | `/v2/order/multi/cancel`              | Cancel multiple / by tag.              | [Cancel multi order](https://upstox.com/developer/api-documentation/cancel-multi-order) |
| POST   | `/v2/order/positions/exit`            | Exit all positions (optional filters). | [Exit all positions](https://upstox.com/developer/api-documentation/exit-all-positions) |


### GTT orders (v3)


| Method | Path                   | Summary            | Doc                                                                                           |
| ------ | ---------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| POST   | `/v3/order/gtt/place`  | Place GTT order.   | [Place GTT order](https://upstox.com/developer/api-documentation/place-gtt-order)             |
| PUT    | `/v3/order/gtt/modify` | Modify GTT order.  | [Modify GTT order](https://upstox.com/developer/api-documentation/modify-gtt-order)           |
| DELETE | `/v3/order/gtt/cancel` | Cancel GTT order.  | [Cancel GTT order](https://upstox.com/developer/api-documentation/cancel-gtt-order)           |
| GET    | `/v3/order/gtt`        | GTT order details. | [Get GTT order details](https://upstox.com/developer/api-documentation/get-gtt-order-details) |


### Portfolio


| Method | Path                                 | Summary                   | Doc                                                                                   |
| ------ | ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/v2/portfolio/long-term-holdings`   | Holdings.                 | [Get holdings](https://upstox.com/developer/api-documentation/get-holdings)           |
| GET    | `/v2/portfolio/short-term-positions` | Positions.                | [Get positions](https://upstox.com/developer/api-documentation/get-positions)         |
| PUT    | `/v2/portfolio/convert-position`     | Convert position product. | [Convert positions](https://upstox.com/developer/api-documentation/convert-positions) |
| GET    | `/v3/portfolio/mtf-positions`        | MTF positions.            | [Get MTF positions](https://upstox.com/developer/api-documentation/get-mtf-positions) |


### Trade profit and loss


| Method | Path                             | Summary                     | Doc                                                                                          |
| ------ | -------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/v2/trade/profit-loss/charges`  | P&L-related charges.        | [P&L on trades / charges](https://upstox.com/developer/api-documentation/get-trade-charges)  |
| GET    | `/v2/trade/profit-loss/data`     | Trade-wise P&L report data. | [P&L report data](https://upstox.com/developer/api-documentation/get-profit-and-loss-report) |
| GET    | `/v2/trade/profit-loss/metadata` | Report metadata.            | [Report meta data](https://upstox.com/developer/api-documentation/get-report-meta-data)      |


### Historical candle data


| Method | Path                                                                            | Summary                        | Doc                                                                                                       |
| ------ | ------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| GET    | `/v2/historical-candle/intraday/{instrumentKey}/{interval}`                     | Intraday candles (v2).         | [Intraday candle data](https://upstox.com/developer/api-documentation/get-intra-day-candle-data)          |
| GET    | `/v2/historical-candle/{instrumentKey}/{interval}/{to_date}`                    | Historical candles (v2).       | [Historical candle data](https://upstox.com/developer/api-documentation/get-historical-candle-data)       |
| GET    | `/v2/historical-candle/{instrumentKey}/{interval}/{to_date}/{from_date}`        | Historical candles range (v2). | [Historical candle data](https://upstox.com/developer/api-documentation/get-historical-candle-data)       |
| GET    | `/v3/historical-candle/intraday/{instrumentKey}/{unit}/{interval}`              | Intraday candles (v3).         | [Intraday candle data v3](https://upstox.com/developer/api-documentation/get-intra-day-candle-data-v3)    |
| GET    | `/v3/historical-candle/{instrumentKey}/{unit}/{interval}/{to_date}`             | Historical candles (v3).       | [Historical candle data v3](https://upstox.com/developer/api-documentation/get-historical-candle-data-v3) |
| GET    | `/v3/historical-candle/{instrumentKey}/{unit}/{interval}/{to_date}/{from_date}` | Historical candles range (v3). | [Historical candle data v3](https://upstox.com/developer/api-documentation/get-historical-candle-data-v3) |


### Market quote


| Method | Path                            | Summary                   | Doc                                                                                        |
| ------ | ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/v2/market-quote/ltp`          | LTP batch.                | [LTP quotes](https://upstox.com/developer/api-documentation/ltp)                           |
| GET    | `/v2/market-quote/ohlc`         | OHLC batch.               | [OHLC quotes](https://upstox.com/developer/api-documentation/get-market-quote-ohlc)        |
| GET    | `/v2/market-quote/quotes`       | Full quotes (depth etc.). | [Full market quotes](https://upstox.com/developer/api-documentation/get-full-market-quote) |
| GET    | `/v3/market-quote/ltp`          | LTP batch (v3).           | [LTP quotes v3](https://upstox.com/developer/api-documentation/ltp-v3)                     |
| GET    | `/v3/market-quote/ohlc`         | OHLC batch (v3).          | [OHLC quotes v3](https://upstox.com/developer/api-documentation/get-market-quote-ohlc-v3)  |
| GET    | `/v3/market-quote/option-greek` | Option Greeks.            | [Option Greeks](https://upstox.com/developer/api-documentation/option-greek)               |


### Market information (holidays and timings)


| Method | Path                           | Summary                        | Doc                                                                                   |
| ------ | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------- |
| GET    | `/v2/market/holidays`          | Holiday list (year).           | [Market holidays](https://upstox.com/developer/api-documentation/get-market-holidays) |
| GET    | `/v2/market/holidays/{date}`   | Holiday on a date.             | [Market holidays](https://upstox.com/developer/api-documentation/get-market-holidays) |
| GET    | `/v2/market/timings/{date}`    | Session timings on a date.     | [Market timings](https://upstox.com/developer/api-documentation/get-market-timings)   |
| GET    | `/v2/market/status/{exchange}` | Market status for an exchange. | [Exchange status](https://upstox.com/developer/api-documentation/get-market-status)   |


### Options (chain and contracts)


| Method | Path                  | Summary                          | Doc                                                                                         |
| ------ | --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/v2/option/chain`    | Put/call option chain.           | [Put/call option chain](https://upstox.com/developer/api-documentation/get-pc-option-chain) |
| GET    | `/v2/option/contract` | Option contracts for underlying. | [Option contracts](https://upstox.com/developer/api-documentation/get-option-contracts)     |


### Instruments


| Method | Path                     | Summary                                     | Doc                                                                                    |
| ------ | ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/v2/instruments/search` | Search instruments (no full file download). | [Search instruments](https://upstox.com/developer/api-documentation/instrument-search) |


### Expired instruments


| Method | Path                                                                                                  | Summary                         | Doc                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v2/expired-instruments/expiries`                                                                    | Expiries for underlying.        | [Get expiries](https://upstox.com/developer/api-documentation/get-expiries)                                         |
| GET    | `/v2/expired-instruments/future/contract`                                                             | Expired futures contracts.      | [Expired future contracts](https://upstox.com/developer/api-documentation/get-expired-future-contracts)             |
| GET    | `/v2/expired-instruments/option/contract`                                                             | Expired option contracts.       | [Expired option contracts](https://upstox.com/developer/api-documentation/get-expired-option-contracts)             |
| GET    | `/v2/expired-instruments/historical-candle/{expired_instrument_key}/{interval}/{to_date}/{from_date}` | Candles for expired instrument. | [Expired historical candle data](https://upstox.com/developer/api-documentation/get-expired-historical-candle-data) |


### WebSocket feed helpers (REST — returns feed / authorize info)


| Method | Path                                       | Summary                              | Doc                                                                                                                   |
| ------ | ------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v2/feed/market-data-feed`                | Market data WebSocket feed metadata. | [Market data feed](https://upstox.com/developer/api-documentation/get-market-data-feed)                               |
| GET    | `/v2/feed/market-data-feed/authorize`      | Authorize URL for market feed.       | [Market data feed authorize](https://upstox.com/developer/api-documentation/get-market-data-feed-authorize)           |
| GET    | `/v2/feed/portfolio-stream-feed`           | Portfolio stream feed metadata.      | [Portfolio stream feed](https://upstox.com/developer/api-documentation/get-portfolio-stream-feed)                     |
| GET    | `/v2/feed/portfolio-stream-feed/authorize` | Authorize URL for portfolio stream.  | [Portfolio stream feed authorize](https://upstox.com/developer/api-documentation/get-portfolio-stream-feed-authorize) |


The portal also documents **Market Data Feeder v3** (WebSocket) separately from these v2 REST helpers — see [announcement](https://upstox.com/developer/api-documentation/announcements/new-market-feeder-v3) and [Streamer functions](https://upstox.com/developer/api-documentation/streamer-function). Those flows are **not** separate rows in the OpenAPI file above; use the linked docs for v3 streaming migration.

---

## Response notes (selected user endpoints)

### Get profile (`GET /v2/user/profile`)

Typical `**data`** fields:


| Field         | Type     | Notes                                                                     |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `email`       | string   | May be masked in docs.                                                    |
| `exchanges`   | string[] | e.g. NSE, NFO, BSE, CDS, BFO, BCD — see Exchange appendix in Upstox docs. |
| `products`    | string[] | e.g. `I`, `D`, `CO`, `MTF`.                                               |
| `broker`      | string   | e.g. `UPSTOX`.                                                            |
| `user_id`     | string   | UCC-style identifier.                                                     |
| `user_name`   | string   |                                                                           |
| `order_types` | string[] | e.g. MARKET, LIMIT, SL, SL-M.                                             |
| `user_type`   | string   | e.g. `individual` for retail.                                             |
| `poa`         | boolean  | Power of attorney.                                                        |
| `ddpi`        | boolean  | DDPI authorization.                                                       |
| `is_active`   | boolean  | Account active.                                                           |


### Get funds and margin v3 (`GET /v3/user/get-funds-and-margin`)

Send header `**Api-Version: 3.0**`. Cash vs pledge breakdown; **available_to_trade** vs **unavailable_to_trade** (unsettled P&L, blocked pledge, etc.).

Top-level `**data`**:

- `available_to_trade` — `total`, `cash_available_to_trade`, `pledge_available_to_trade` (nested cash / margin_from_pledge and margin_used breakdowns).
- `unavailable_to_trade` — `cash_unavailable_to_trade`, `pledge_unavailable_to_trade`.

Use the official field tables on [Get funds and margin v3](https://upstox.com/developer/api-documentation/get-funds-and-margin-v3) for precise meanings.

---

## Agent implementation checklist

1. Parse `**status**` first; on `"error"`, read `**errors[]**` and `**error_code**` / `**message**`.
2. Prefer **snake_case** error fields; do not rely on deprecated camelCase.
3. Send `**Api-Version: 3.0`** only for APIs that document it (e.g. funds v3).
4. Respect **rate limits** by endpoint class (orders vs standard); treat **429** and **UDAPI10005** as throttle signals.
5. Use **URL-encoded** queries and paths.
6. For OAuth, obtain and refresh **access tokens** per [Authentication](https://upstox.com/developer/api-documentation/authentication).

---

## Sources


| Topic                                   | URL                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Open API hub (index)                    | [https://upstox.com/developer/api-documentation/open-api](https://upstox.com/developer/api-documentation/open-api)                     |
| OpenAPI spec (JSON)                     | [https://api.upstox.com/v2/api-docs](https://api.upstox.com/v2/api-docs)                                                               |
| Swagger UI                              | [https://api.upstox.com/v2/swagger-ui/index.html](https://api.upstox.com/v2/swagger-ui/index.html)                                     |
| Machine-readable doc index (`llms.txt`) | [https://upstox.com/developer/api-documentation/llms.txt](https://upstox.com/developer/api-documentation/llms.txt)                     |
| Request/response hub                    | [https://upstox.com/developer/api-documentation/request-response](https://upstox.com/developer/api-documentation/request-response)     |
| Request structure                       | [https://upstox.com/developer/api-documentation/request-structure](https://upstox.com/developer/api-documentation/request-structure)   |
| Response structure                      | [https://upstox.com/developer/api-documentation/response-structure](https://upstox.com/developer/api-documentation/response-structure) |
| Error codes                             | [https://upstox.com/developer/api-documentation/error-codes](https://upstox.com/developer/api-documentation/error-codes)               |
| Rate limiting                           | [https://upstox.com/developer/api-documentation/rate-limiting](https://upstox.com/developer/api-documentation/rate-limiting)           |


