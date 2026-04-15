import { useState, useEffect, useRef } from 'react'
import { createChart, LineSeries, ColorType } from 'lightweight-charts'
import { FlaskConical, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/AppShell'
import {
  useStrategiesQuery,
  useRunBacktestMutation,
  useBacktestHistoryQuery,
  useBacktestResultQuery,
} from '@/lib/backtest-queries'
import { useTrackedInstrumentsQuery } from '@/lib/market-data-queries'
import type { BacktestConfig, BacktestResult, BacktestRunSummary } from '@/lib/api'

/* ── Equity Chart ──────────────────────────────────────────────────── */

function EquityChart({ equityCurve }: { equityCurve: { timestamp: string; equity: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || equityCurve.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
    })

    const series = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 2 })
    // Deduplicate: multiple intraday points share same date — keep last per day
    const byDay = new Map<string, number>()
    for (const p of equityCurve) {
      byDay.set(p.timestamp.slice(0, 10), p.equity)
    }
    series.setData(
      Array.from(byDay, ([time, value]) => ({ time, value })),
    )
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [equityCurve])

  return <div ref={containerRef} className="w-full" />
}

/* ── Metrics Cards ─────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  colorClass,
}: {
  label: string
  value: string
  colorClass?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${colorClass ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

/* ── Results Panel ─────────────────────────────────────────────────── */

function ResultsPanel({ result }: { result: BacktestResult }) {
  const { metrics, trades, equityCurve } = result
  const pnlPositive = metrics.totalPnl >= 0

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Total PnL"
          value={`₹${metrics.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${metrics.totalPnlPercent.toFixed(2)}%)`}
          colorClass={pnlPositive ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          colorClass={metrics.winRate >= 50 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${metrics.maxDrawdownPercent.toFixed(2)}%`}
          colorClass="text-red-400"
        />
        <MetricCard label="Total Trades" value={String(metrics.totalTrades)} />
        <MetricCard
          label="Avg Profit/Trade"
          value={`₹${metrics.avgProfitPerTrade.toFixed(2)}`}
          colorClass={metrics.avgProfitPerTrade >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Equity curve */}
      {equityCurve.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityChart equityCurve={equityCurve} />
          </CardContent>
        </Card>
      )}

      {/* Trade list */}
      {trades.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trades ({trades.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {t.timestamp.slice(0, 10)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={t.action === 'BUY' ? 'default' : 'secondary'}
                          className={
                            t.action === 'BUY'
                              ? 'bg-green-900/50 text-green-400 border-green-800'
                              : 'bg-red-900/50 text-red-400 border-red-800'
                          }
                        >
                          {t.action === 'BUY' ? (
                            <TrendingUp className="mr-1 h-3 w-3" />
                          ) : (
                            <TrendingDown className="mr-1 h-3 w-3" />
                          )}
                          {t.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        ₹{t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{t.quantity}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{t.reason}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        ₹{t.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ── History Panel ─────────────────────────────────────────────────── */

function HistoryPanel({
  onSelectRun,
  selectedId,
}: {
  onSelectRun: (id: number) => void
  selectedId: number | null
}) {
  const { data: history = [], isPending } = useBacktestHistoryQuery()

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No past backtests yet. Run one above.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Past Runs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Strategy</th>
                <th className="px-4 py-3 font-medium">Instrument</th>
                <th className="px-4 py-3 font-medium text-right">PnL</th>
                <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                <th className="px-4 py-3 font-medium text-right">Trades</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((run: BacktestRunSummary) => {
                const pnlPositive = run.total_pnl >= 0
                return (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={`cursor-pointer border-b last:border-0 hover:bg-accent/50 ${
                      selectedId === run.id ? 'bg-accent/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{run.strategy_name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                      {run.instrument_key}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono font-medium ${
                        pnlPositive ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {pnlPositive ? '+' : ''}₹{run.total_pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">{run.win_rate.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right">{run.total_trades}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {run.created_at.slice(0, 10)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

/* ── Config Form ───────────────────────────────────────────────────── */

const TODAY = new Date().toISOString().slice(0, 10)
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function ConfigForm({ onResult }: { onResult: (r: BacktestResult) => void }) {
  const { data: strategies = [], isPending: strategiesLoading } = useStrategiesQuery()
  const { data: instruments = [], isPending: instrumentsLoading } = useTrackedInstrumentsQuery()
  const runMutation = useRunBacktestMutation()

  const [collapsed, setCollapsed] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [instrumentKey, setInstrumentKey] = useState('')
  const [from, setFrom] = useState(ONE_YEAR_AGO)
  const [to, setTo] = useState(TODAY)
  const [interval, setIntervalVal] = useState<'1d' | '1h' | '1m'>('1d')
  const [initialBalance, setInitialBalance] = useState(100000)
  const [params, setParams] = useState<Record<string, number>>({})

  // When strategy changes, populate default params
  useEffect(() => {
    if (!strategyName) return
    const strategy = strategies.find((s) => s.name === strategyName)
    if (strategy) {
      setParams({ ...strategy.defaultParams })
    }
  }, [strategyName, strategies])

  // Auto-select first strategy and instrument when data loads
  useEffect(() => {
    if (strategies.length > 0 && !strategyName) {
      setStrategyName(strategies[0].name)
    }
  }, [strategies, strategyName])

  useEffect(() => {
    if (instruments.length > 0 && !instrumentKey) {
      setInstrumentKey(instruments[0].instrument_key)
    }
  }, [instruments, instrumentKey])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!strategyName || !instrumentKey) return

    const config: BacktestConfig = {
      strategyName,
      instrumentKey,
      from,
      to,
      interval,
      initialBalance,
      params,
    }

    runMutation.mutate(config, {
      onSuccess: (result) => {
        onResult(result)
        setCollapsed(true)
      },
    })
  }

  const selectedStrategy = strategies.find((s) => s.name === strategyName)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Configuration
          </CardTitle>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Strategy */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="strategy-select">
                  Strategy
                </label>
                {strategiesLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <select
                    id="strategy-select"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select strategy...
                    </option>
                    {strategies.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedStrategy?.description && (
                  <p className="text-xs text-muted-foreground">{selectedStrategy.description}</p>
                )}
              </div>

              {/* Instrument */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="instrument-select">
                  Instrument
                </label>
                {instrumentsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : instruments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tracked instruments. Add one in Market Data first.
                  </p>
                ) : (
                  <select
                    id="instrument-select"
                    value={instrumentKey}
                    onChange={(e) => setInstrumentKey(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select instrument...
                    </option>
                    {instruments.map((inst) => (
                      <option key={inst.instrument_key} value={inst.instrument_key}>
                        {inst.name || inst.instrument_key} ({inst.exchange})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* From */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="from-date">
                  From
                </label>
                <Input
                  id="from-date"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              {/* To */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="to-date">
                  To
                </label>
                <Input
                  id="to-date"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {/* Initial Balance */}
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="initial-balance">
                  Initial Balance (₹)
                </label>
                <Input
                  id="initial-balance"
                  type="number"
                  min={1000}
                  step={1000}
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Interval */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Interval</label>
              <div className="flex gap-2">
                {(['1d', '1h', '1m'] as const).map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setIntervalVal(iv)}
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
            </div>

            {/* Dynamic strategy params */}
            {Object.keys(params).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Strategy Parameters</label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(params).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor={`param-${key}`}>
                        {key}
                      </label>
                      <Input
                        id={`param-${key}`}
                        type="number"
                        step="any"
                        value={val}
                        onChange={(e) =>
                          setParams((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runMutation.isError && (
              <p className="text-sm text-destructive">
                {(runMutation.error as Error)?.message ?? 'Backtest failed'}
              </p>
            )}

            <Button
              type="submit"
              disabled={runMutation.isPending || !strategyName || !instrumentKey}
              className="w-full sm:w-auto"
            >
              {runMutation.isPending ? 'Running...' : 'Run Backtest'}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  )
}

/* ── HistoryResultLoader ───────────────────────────────────────────── */

function HistoryResultLoader({
  selectedHistoryId,
  onResult,
}: {
  selectedHistoryId: number
  onResult: (r: BacktestResult) => void
}) {
  const { data, isPending } = useBacktestResultQuery(selectedHistoryId)

  useEffect(() => {
    if (data) onResult(data)
  }, [data, onResult])

  if (isPending) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading result...
        </CardContent>
      </Card>
    )
  }

  return null
}

/* ── BacktestPage ──────────────────────────────────────────────────── */

export function BacktestPage() {
  const [currentResult, setCurrentResult] = useState<BacktestResult | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)

  function handleSelectHistoryRun(id: number) {
    setSelectedHistoryId(id)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Backtest</h2>

        {/* Config form */}
        <ConfigForm onResult={setCurrentResult} />

        {/* Load historical result if selected */}
        {selectedHistoryId !== null && (
          <HistoryResultLoader
            selectedHistoryId={selectedHistoryId}
            onResult={setCurrentResult}
          />
        )}

        {/* Results */}
        {currentResult && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold">
              Results — {currentResult.config.strategyName} on{' '}
              {currentResult.config.instrumentKey}
            </h3>
            <ResultsPanel result={currentResult} />
          </div>
        )}

        {/* History */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold">History</h3>
          <HistoryPanel
            onSelectRun={handleSelectHistoryRun}
            selectedId={selectedHistoryId}
          />
        </div>
      </div>
    </AppShell>
  )
}
