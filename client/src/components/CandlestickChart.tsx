import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  type LogicalRange,
  type MouseEventParams,
} from 'lightweight-charts'
import type { CandleData } from '@/lib/api'

interface CandlestickChartProps {
  candles: CandleData[]
  loading?: boolean
  interval: '1d' | '1h' | '1m'
  onLoadMore?: () => void
  onCrosshairMove?: (data: {
    open: number
    high: number
    low: number
    close: number
    volume: number
  } | null) => void
}

function transformCandles(
  candles: CandleData[],
  interval: '1d' | '1h' | '1m',
): { candlestickData: CandlestickData[]; volumeData: HistogramData[] } {
  const candlestickData: CandlestickData[] = []
  const volumeData: HistogramData[] = []

  for (const c of candles) {
    let time: Time
    if (interval === '1d') {
      // Daily: lightweight-charts accepts "YYYY-MM-DD" strings
      time = c.timestamp.slice(0, 10) as string as Time
    } else {
      // Intraday: need UTCTimestamp (seconds since epoch)
      // Hourly timestamps from server are truncated "YYYY-MM-DDTHH" (13 chars)
      // which Date can't parse — normalize to valid ISO first
      const ts = c.timestamp.length === 13 ? c.timestamp + ':00:00' : c.timestamp
      time = Math.floor(new Date(ts).getTime() / 1000) as unknown as Time
    }

    const color = c.close >= c.open ? '#22c55e' : '#ef4444'

    candlestickData.push({
      time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })

    volumeData.push({
      time,
      value: c.volume,
      color: color + '40',
    })
  }

  return { candlestickData, volumeData }
}

const LOAD_MORE_THRESHOLD = 10

export function CandlestickChart({
  candles,
  loading,
  interval,
  onLoadMore,
  onCrosshairMove,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const loadingMoreRef = useRef(false)
  const onLoadMoreRef = useRef(onLoadMore)
  const onCrosshairMoveRef = useRef(onCrosshairMove)
  const hasFitRef = useRef(false)

  // Keep callback refs fresh
  onLoadMoreRef.current = onLoadMore
  onCrosshairMoveRef.current = onCrosshairMove

  // Create / recreate chart when interval changes (time format differs between daily and intraday)
  useEffect(() => {
    if (!containerRef.current) return

    hasFitRef.current = false

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#999',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: 'rgba(255,255,255,0.15)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#333',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.15)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#333',
        },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: interval !== '1d',
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    volumeSeriesRef.current = volumeSeries

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    // Crosshair subscription
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData) {
        onCrosshairMoveRef.current?.(null)
        return
      }
      const candleData = param.seriesData.get(candleSeriesRef.current!) as
        | CandlestickData
        | undefined
      const volumeData = param.seriesData.get(volumeSeriesRef.current!) as
        | HistogramData
        | undefined
      if (candleData) {
        onCrosshairMoveRef.current?.({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData?.value ?? 0,
        })
      }
    })

    // Visible range subscription for infinite scroll
    chart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (!range || loadingMoreRef.current) return
      if (range.from < LOAD_MORE_THRESHOLD) {
        loadingMoreRef.current = true
        onLoadMoreRef.current?.()
        setTimeout(() => {
          loadingMoreRef.current = false
        }, 1000)
      }
    })

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.resize(width, height)
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [interval])

  // Update timeScale timeVisible when interval changes
  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      timeVisible: interval !== '1d',
    })
  }, [interval])

  // Update data when candles or interval change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

    const { candlestickData, volumeData } = transformCandles(candles, interval)

    candleSeriesRef.current.setData(candlestickData)
    volumeSeriesRef.current.setData(volumeData)

    if (!hasFitRef.current) {
      chartRef.current?.timeScale().fitContent()
      hasFitRef.current = true
    }
  }, [candles, interval])

  if (loading && candles.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#0a0a0a]">
        <div className="flex w-3/4 items-end gap-1" style={{ height: '60%' }}>
          {Array.from({ length: 40 }, (_, i) => {
            const h = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 25
            return (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-sm bg-zinc-800"
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
        <div className="mt-4 text-sm text-zinc-600">Loading chart data...</div>
      </div>
    )
  }

  if (!candles.length) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#0a0a0a]">
        <p className="text-sm text-zinc-600">No data available</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}
