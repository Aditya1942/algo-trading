import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { CandlestickChart } from '@/components/CandlestickChart'
import {
  useTrackedInstrumentsQuery,
  useCandlesQuery,
} from '@/lib/market-data-queries'

/* ── Constants ─────────────────────────────────────────────────────── */

const FILTERS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'] as const
type FilterKey = (typeof FILTERS)[number]

const FILTER_MONTHS: Record<FilterKey, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  '3Y': 36,
  '5Y': 60,
  'ALL': 0,
}

const MAX_FILTER: Record<'1d' | '1h' | '1m', FilterKey> = {
  '1d': 'ALL',
  '1h': '1Y',
  '1m': '1M',
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getFromDate(filter: FilterKey): string | undefined {
  if (filter === 'ALL') return undefined
  return toDateString(subtractMonths(new Date(), FILTER_MONTHS[filter]))
}

function exchangeColor(exchange: string): string {
  switch (exchange?.toUpperCase()) {
    case 'NSE':
      return 'bg-green-900/50 text-green-400 border-green-800'
    case 'BSE':
      return 'bg-blue-900/50 text-blue-400 border-blue-800'
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700'
  }
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ChartPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const instrumentId = Number(id)

  const [interval, setInterval] = useState<'1d' | '1h' | '1m'>('1d')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('1Y')
  const [fromDate, setFromDate] = useState<string | undefined>(() => getFromDate('1Y'))
  const [crosshairData, setCrosshairData] = useState<{
    open: number
    high: number
    low: number
    close: number
    volume: number
  } | null>(null)

  /* ── Filter / interval handlers ──────────────────────────────────── */

  function handleFilterChange(filter: FilterKey) {
    setActiveFilter(filter)
    setFromDate(getFromDate(filter))
  }

  function handleIntervalChange(newInterval: '1d' | '1h' | '1m') {
    setInterval(newInterval)
    const maxFilter = MAX_FILTER[newInterval]
    const maxMonths = FILTER_MONTHS[maxFilter]
    const currentMonths = FILTER_MONTHS[activeFilter]
    // If current range exceeds max for this interval (0 = ALL = infinity)
    if (maxMonths > 0 && (currentMonths === 0 || currentMonths > maxMonths)) {
      handleFilterChange(maxFilter)
    }
  }

  // Extend range further into past when chart scrolls to left edge
  const handleLoadMore = useCallback(() => {
    if (activeFilter === 'ALL') return // already fetching everything

    setFromDate((prev) => {
      if (!prev) return prev // ALL — nothing to extend
      const currentFrom = new Date(prev)
      const months = FILTER_MONTHS[activeFilter] || 12
      const newFrom = subtractMonths(currentFrom, months)
      return toDateString(newFrom)
    })
  }, [activeFilter])

  /* ── Queries ─────────────────────────────────────────────────────── */

  const { data: instruments = [], isPending: instrumentsLoading } =
    useTrackedInstrumentsQuery()
  const instrument = instruments.find((i) => i.id === instrumentId)

  // Main chart candles — uses selected interval
  const {
    data: candles = [],
    isPending: candlesLoading,
    isError: candlesError,
  } = useCandlesQuery(instrumentId, fromDate, undefined, interval)

  // Separate daily query for price header — always shows daily close-to-close
  const dailyFrom = toDateString(subtractMonths(new Date(), 1))
  const { data: dailyCandles = [] } = useCandlesQuery(
    instrumentId,
    dailyFrom,
    undefined,
    '1d',
  )

  /* ── Price calculations from daily candles ───────────────────────── */

  const latestDaily =
    dailyCandles.length > 0 ? dailyCandles[dailyCandles.length - 1] : null
  const prevDaily =
    dailyCandles.length > 1 ? dailyCandles[dailyCandles.length - 2] : null
  const priceChange =
    latestDaily && prevDaily ? latestDaily.close - prevDaily.close : 0
  const priceChangePct =
    latestDaily && prevDaily && prevDaily.close !== 0
      ? (priceChange / prevDaily.close) * 100
      : 0
  const isPositive = priceChange >= 0

  /* ── Interval-aware filter list ──────────────────────────────────── */

  const availableFilters = FILTERS.filter((f) => {
    const maxFilter = MAX_FILTER[interval]
    const maxMonths = FILTER_MONTHS[maxFilter]
    if (maxMonths === 0) return true // ALL = no limit
    const fMonths = FILTER_MONTHS[f]
    return fMonths > 0 && fMonths <= maxMonths
  })

  /* ── Not-found early return ──────────────────────────────────────── */

  if (!instrumentsLoading && !instrument) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/market-data')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Market Data
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 opacity-40" />
              <p>Instrument not found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/market-data')}
              >
                Go to Market Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  /* ── No-data state ───────────────────────────────────────────────── */

  const noData =
    !candlesLoading && !candlesError && candles.length === 0 && instrument

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <AppShell>
      <div className="flex h-full flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate('/market-data')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {instrumentsLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${exchangeColor(instrument?.exchange ?? '')}`}
                  >
                    {instrument?.exchange ?? ''}
                  </Badge>
                  <span className="text-lg font-semibold">
                    {instrument?.instrument_key?.split('|')[1] ??
                      instrument?.instrument_key}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {instrument?.name}
                  </span>
                </>
              )}
            </div>
            {latestDaily && (
              <div className="flex items-baseline gap-2 pl-10">
                <span className="text-2xl font-bold">
                  ₹
                  {latestDaily.close.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                >
                  {isPositive ? '+' : ''}
                  {priceChange.toFixed(2)} ({isPositive ? '+' : ''}
                  {priceChangePct.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Time range filters (green) */}
        <div className="flex gap-1">
          {availableFilters.map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                f === activeFilter
                  ? 'bg-green-900/50 text-green-400 border border-green-500'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Interval selector (blue) */}
        <div className="flex gap-1">
          {(['1d', '1h', '1m'] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => handleIntervalChange(iv)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                iv === interval
                  ? 'bg-blue-900/50 text-blue-400 border border-blue-500'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {iv === '1d' ? 'Daily' : iv === '1h' ? 'Hourly' : '1 Min'}
            </button>
          ))}
        </div>

        {/* Chart Area */}
        {candlesError ? (
          <Card className="flex-1">
            <CardContent className="flex h-full items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="mr-2 h-5 w-5" />
              Failed to load candle data
            </CardContent>
          </Card>
        ) : noData ? (
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              {instrument?.status === 'active' ? (
                <>
                  <Download className="h-10 w-10 animate-pulse opacity-40" />
                  <p>Download in progress...</p>
                  <p className="text-xs">
                    Candles will appear once data is fetched
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-10 w-10 opacity-40" />
                  <p>No candle data available for this time range</p>
                  <p className="text-xs">
                    Try a different time range or check if data has been
                    downloaded
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className="relative min-h-0 flex-1"
            style={{ minHeight: '400px' }}
          >
            {/* OHLCV Legend — absolute overlay on chart */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 font-mono text-xs">
              {(() => {
                const d =
                  crosshairData ??
                  (candles.length > 0
                    ? {
                        open: candles[candles.length - 1].open,
                        high: candles[candles.length - 1].high,
                        low: candles[candles.length - 1].low,
                        close: candles[candles.length - 1].close,
                        volume: candles[candles.length - 1].volume,
                      }
                    : null)
                if (!d) return null
                const up = d.close >= d.open
                return (
                  <div className="flex gap-3">
                    <span className="text-zinc-500">
                      O{' '}
                      <span
                        className={up ? 'text-green-400' : 'text-red-400'}
                      >
                        {d.open.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      H{' '}
                      <span
                        className={up ? 'text-green-400' : 'text-red-400'}
                      >
                        {d.high.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      L{' '}
                      <span
                        className={up ? 'text-green-400' : 'text-red-400'}
                      >
                        {d.low.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      C{' '}
                      <span
                        className={up ? 'text-green-400' : 'text-red-400'}
                      >
                        {d.close.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      V{' '}
                      <span className="text-zinc-400">
                        {d.volume.toLocaleString()}
                      </span>
                    </span>
                  </div>
                )
              })()}
            </div>
            <CandlestickChart
              candles={candles}
              loading={candlesLoading}
              interval={interval}
              onLoadMore={handleLoadMore}
              onCrosshairMove={setCrosshairData}
            />
          </div>
        )}

        {/* Footer */}
        {instrument && !candlesLoading && candles.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {candles.length.toLocaleString()}{' '}
              {interval === '1d'
                ? 'days'
                : interval === '1h'
                  ? 'hours'
                  : 'candles'}
              {candles.length > 0 &&
                ` \u00b7 ${candles[0].timestamp.slice(0, 10)} \u2192 ${candles[candles.length - 1].timestamp.slice(0, 10)}`}
            </span>
            {latestDaily && (
              <span>
                Last close: ₹
                {latestDaily.close.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
