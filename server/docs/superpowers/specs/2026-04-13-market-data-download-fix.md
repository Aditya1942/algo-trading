# Market Data Download Fix

## Problem

User searches instruments on Instruments page, finds GOLDBEES stored as `NSE_EQ|INF204KB17I5`. Goes to Market Data page, manually types `INF204KB17I5` in Add Instrument dialog. Worker sends bare ISIN to Upstox historical candle API → 400 error. No integration between instruments cache and download feature.

## Solution

Two changes that connect instruments cache to market-data download.

### Change 1: Download Button on Stored Instruments Rows

Each row in the stored instruments list (Instruments page, stored tab) shows one of:
- **Download button** — if `instrument_key` is NOT in `tracked_instruments`
- **Status badge** ("Downloading", "Paused", "Completed", "Error") — if already tracked

Click Download → `POST /api/v1/market-data/instruments` with `instrument_key`, `name`, `exchange` from cached instrument. All fields auto-populated, no manual typing needed.

**New endpoint:** `GET /api/v1/market-data/instruments/keys`
- Returns `{ data: string[] }` — list of all `instrument_key` values in `tracked_instruments`
- Client uses this to determine which stored instruments are already tracked
- Lightweight, no joins needed

### Change 2: Autocomplete in AddInstrumentDialog

Replace plain text `<Input>` for instrument key with search-as-you-type:
- On typing 2+ chars, query `GET /api/v1/stored-instruments?search=<term>&page=1&limit=10`
- Show dropdown with matching instruments (trading_symbol, name, instrument_key)
- Selecting an item fills `instrument_key` and `name` fields automatically
- Manual entry still allowed — user can dismiss dropdown and type raw key

Uses existing `searchStoredInstruments` API, no new server endpoint needed.

## Files Changed

### Server
| File | Change |
|------|--------|
| `api/market-data.ts` | Add `handleGetTrackedKeys` handler |
| `modules/market-data/db.ts` | Add `listTrackedInstrumentKeys()` function |
| `modules/market-data/index.ts` | Export new function |
| `index.ts` | Register `GET /api/v1/market-data/instruments/keys` route |

### Client
| File | Change |
|------|--------|
| `lib/api.ts` | Add `getTrackedInstrumentKeys()` fetch function |
| `lib/market-data-queries.ts` | Add `useTrackedInstrumentKeysQuery()` hook |
| `pages/InstrumentsPage.tsx` | Add Download button + status badge per stored instrument row |
| `pages/MarketDataPage.tsx` | Replace plain Input with autocomplete dropdown in AddInstrumentDialog |

### Not Changed
- `modules/market-data/worker.ts` — no changes, logic is correct
- `modules/market-data/db.ts` candle/progress logic — untouched
- `shared/upstox.ts` — untouched

## Testing

- Existing `db.test.ts` — add test for `listTrackedInstrumentKeys()`
- Manual: add GOLDBEES via Download button on instruments page, verify worker picks up correct key and downloads candles
