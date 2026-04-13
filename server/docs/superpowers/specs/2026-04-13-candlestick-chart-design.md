# Candlestick Chart — Investment Detail Page

## Context

Market Data page shows tracked instruments with download status but no way to visualize candle data. User clicks instrument → should open full chart page with candlestick visualization and timeline filters. Modeled after Upstox chart page.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Navigation | New route `/market-data/:id/chart` — full page |
| Charting library | TradingView Lightweight Charts (`lightweight-charts`) |
| Layout | Chart-focused, single column (Upstox style) |
| Timeline filters | 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL — default 1Y |
| Volume | Separate histogram pane below candles (~20% height) |

## Page Structure

```
┌─────────────────────────────────────────────────────┐
│ ← Back    [NSE] RELIANCE  Reliance Industries Ltd   │
│           ₹2,847.50  +32.15 (+1.14%)                │
├─────────────────────────────────────────────────────┤
│ [1M] [3M] [6M] [1Y] [3Y] [5Y] [ALL]               │
├─────────────────────────────────────────────────────┤
│                                                     │
│            Candlestick Chart (~75% height)           │
│            - OHLC candles                            │
│            - Crosshair with tooltip                  │
│            - Price axis (right)                      │
│            - Time axis (bottom)                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│            Volume Histogram (~20% height)            │
│            - Green/red matching candle color          │
│            - Shared time axis                        │
├─────────────────────────────────────────────────────┤
│ Data range: 2020-01-15 → 2024-12-20 · 1,247 candles│
└─────────────────────────────────────────────────────┘
```

## Header Section

- **Back button**: navigates to `/market-data`
- **Exchange badge**: colored pill (NSE=green, BSE=blue)
- **Trading symbol**: bold, primary text
- **Instrument name**: muted secondary text
- **Latest price**: large font, from last candle's `close`
- **Change**: calculated from last two candles — green positive, red negative, with absolute + percentage

## Timeline Filters

Pill buttons: `1M | 3M | 6M | 1Y | 3Y | 5Y | ALL`

- Active filter: green background + border (matches app theme)
- Default: 1Y
- On click: recalculate `from` date relative to today, refetch candles
- ALL: uses earliest available data (no `from` param)

Date calculation:
```
1M  → today - 1 month
3M  → today - 3 months
6M  → today - 6 months
1Y  → today - 1 year
3Y  → today - 3 years
5Y  → today - 5 years
ALL → omit `from`, server defaults to 2020-01-01
```

## Candlestick Chart

Uses `lightweight-charts` `CandlestickSeries`:

- **Green candles**: close > open (bullish)
- **Red candles**: close < open (bearish)
- **Crosshair**: enabled, shows OHLCV tooltip on hover
- **Price scale**: right side, auto-scaled
- **Time scale**: bottom, auto-formatted (months for 1Y, years for 5Y)
- **Dark theme**: matches app's dark UI (`background: #0a0a0a`)
- **Responsive**: fills container width, fixed aspect ratio via container

## Volume Histogram

Uses `lightweight-charts` `HistogramSeries`:

- Separate pane below candlestick (using `createPane()` or overlay)
- Bar color matches candle: green if close > open, red otherwise
- Semi-transparent (40% opacity)
- Shares time axis with candle chart
- ~20% of total chart height

## Data Flow

```
User clicks instrument row on MarketDataPage
  → navigate(`/market-data/${inst.id}/chart`)
  → ChartPage loads, reads :id from URL params
  → Fetches instrument details (from existing useTrackedInstrumentsQuery or new single-instrument query)
  → Fetches candles: GET /api/v1/market-data/instruments/:id/candles?from=YYYY-MM-DD&to=YYYY-MM-DD
  → Transforms CandleRow[] to lightweight-charts format: { time, open, high, low, close }
  → Renders chart
```

### Data Transformation

Server returns:
```typescript
{ instrument_key, timestamp, open, high, low, close, volume, oi }
```

Chart needs:
```typescript
// Candlestick series
{ time: 'YYYY-MM-DD', open, high, low, close }

// Volume histogram
{ time: 'YYYY-MM-DD', value: volume, color: close > open ? '#4ade8066' : '#f8717166' }
```

`timestamp` is ISO 8601 — extract date portion for daily candles.

## New Files

| File | Purpose |
|------|---------|
| `client/src/pages/ChartPage.tsx` | Main chart page component |
| `client/src/components/CandlestickChart.tsx` | Reusable chart wrapper around lightweight-charts |

## Modified Files

| File | Change |
|------|--------|
| `client/src/lib/api.ts` | Add `getCandles(id, from?, to?)` function |
| `client/src/lib/market-data-queries.ts` | Add `useCandlesQuery(id, from, to)` hook + query key |
| `client/src/pages/MarketDataPage.tsx` | Make instrument rows clickable → navigate to chart |
| `client/src/App.tsx` | Add `/market-data/:id/chart` route |
| `client/package.json` | Add `lightweight-charts` dependency |

## API Layer Additions

### `client/src/lib/api.ts`
```typescript
export interface CandleData {
  instrument_key: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  oi: number
}

export async function getCandles(
  instrumentId: number,
  from?: string,
  to?: string,
): Promise<CandleData[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  const res = await fetch(`${BASE}/market-data/instruments/${instrumentId}/candles${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch candles')
  const json = await res.json()
  return json.data
}
```

### `client/src/lib/market-data-queries.ts`
```typescript
candles: (id: number, from?: string, to?: string) => ['market-data', 'candles', id, from, to]

export function useCandlesQuery(instrumentId: number, from?: string, to?: string) {
  return useQuery({
    queryKey: marketDataKeys.candles(instrumentId, from, to),
    queryFn: () => getCandles(instrumentId, from, to),
    enabled: !!instrumentId,
    staleTime: 5 * 60 * 1000, // 5 min — historical data doesn't change often
  })
}
```

## Loading & Error States

- **Loading**: Skeleton placeholder matching chart dimensions
- **Error**: Error card with retry button
- **No data**: "No candle data available" message with link back to market data page
- **Sparse data** (<5 candles): Show warning banner "Limited data available"

## Edge Cases

- Instrument not found (invalid ID) → redirect to `/market-data` with toast
- No candles downloaded yet (status: active, 0 candles) → show "Download in progress" state
- Date range with no data → show empty chart with message
- Very large datasets (ALL = 5+ years) → lightweight-charts handles this natively with virtual scrolling

## Verification

1. Navigate to Market Data page → click any instrument with downloaded candles
2. Chart page loads with 1Y of data, candlesticks + volume visible
3. Click each timeline filter → chart updates with correct date range
4. Hover chart → crosshair shows OHLCV tooltip
5. Back button returns to Market Data page
6. Test with instrument that has no candles → shows appropriate empty state
7. Test with invalid instrument ID → redirects gracefully
