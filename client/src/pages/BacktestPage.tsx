import { useState, useEffect, useRef } from 'react'
import { createChart, LineSeries, ColorType } from 'lightweight-charts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/AppShell'
import { RunConfigForm } from '@/components/RunConfigForm'
import {
  useBacktestHistoryQuery,
  useBacktestResultQuery,
} from '@/lib/backtest-queries'
import type { BacktestResult, BacktestRunSummary } from '@/lib/api'

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
        <RunConfigForm onResult={setCurrentResult} />

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
