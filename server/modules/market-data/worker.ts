// server/modules/market-data/worker.ts
import { upstoxGet as _upstoxGet } from '../../shared/upstox'
import { AuthError } from '../../shared/types'
import {
  getNextActiveInstrument,
  insertCandles,
  updateInstrumentProgress,
  updateInstrumentStatus,
  updateInstrumentError,
} from './db'
import type { UpstoxCandleResponse, CandleRow } from './types'

export type WorkerDeps = {
  upstoxGet: typeof _upstoxGet
  delayMs: number
  idleDelayMs: number
  targetStartDate: string
}

const DEFAULT_DEPS: WorkerDeps = {
  upstoxGet: _upstoxGet,
  delayMs: 1_000,          // 1 req/sec rate limit
  idleDelayMs: 10_000,     // 10s when no active instruments
  targetStartDate: '2020-01-01',
}

let timer: ReturnType<typeof setTimeout> | null = null
let running = false
const retryCounts = new Map<number, number>()
const MAX_RETRIES = 3
const FETCH_WINDOW_DAYS = 4

// --- Date helpers ---

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// --- Worker ---

async function tick(deps: WorkerDeps): Promise<void> {
  if (!running) return

  const instrument = getNextActiveInstrument()
  if (!instrument) {
    timer = setTimeout(() => tick(deps), deps.idleDelayMs)
    return
  }

  // Check if already reached target
  if (instrument.earliest_fetched && instrument.earliest_fetched <= deps.targetStartDate) {
    updateInstrumentStatus(instrument.id, 'completed')
    retryCounts.delete(instrument.id)
    timer = setTimeout(() => tick(deps), deps.delayMs)
    return
  }

  // Compute fetch window
  let toDate: string
  let fromDate: string

  if (!instrument.earliest_fetched) {
    // First fetch — start from today
    toDate = today()
    fromDate = subtractDays(toDate, FETCH_WINDOW_DAYS)
  } else {
    // Continue backward from where we left off
    toDate = subtractDays(instrument.earliest_fetched, 1)
    fromDate = subtractDays(toDate, FETCH_WINDOW_DAYS)
  }

  // Clamp from to target
  if (fromDate < deps.targetStartDate) {
    fromDate = deps.targetStartDate
  }

  // If window exhausted, mark completed
  if (fromDate >= toDate) {
    updateInstrumentStatus(instrument.id, 'completed')
    retryCounts.delete(instrument.id)
    timer = setTimeout(() => tick(deps), deps.delayMs)
    return
  }

  try {
    const encodedKey = encodeURIComponent(instrument.instrument_key)
    const path = `/historical-candle/${encodedKey}/1minute/${toDate}/${fromDate}`
    const response = await deps.upstoxGet<UpstoxCandleResponse>(path)

    // Parse candles
    const rawCandles = response?.data?.candles ?? []
    const candles: CandleRow[] = rawCandles.map(([ts, open, high, low, close, volume, oi]) => ({
      instrument_key: instrument.instrument_key,
      timestamp: ts,
      open, high, low, close, volume,
      oi: oi ?? 0,
    }))

    // Store
    if (candles.length > 0) {
      insertCandles(candles)
    }

    // Update progress
    const newEarliest = fromDate
    const newLatest = instrument.latest_fetched ?? toDate
    updateInstrumentProgress(instrument.id, newEarliest, newLatest)

    // Reset retry counter on success
    retryCounts.delete(instrument.id)

  } catch (err) {
    if (err instanceof AuthError) {
      // User not logged in — sleep longer, don't mark error
      console.warn('[MarketDataWorker] Auth error — waiting for login')
      timer = setTimeout(() => tick(deps), 30_000)
      return
    }

    // Track retries
    const retries = (retryCounts.get(instrument.id) ?? 0) + 1
    retryCounts.set(instrument.id, retries)

    if (retries >= MAX_RETRIES) {
      const msg = err instanceof Error ? err.message : String(err)
      updateInstrumentError(instrument.id, msg)
      retryCounts.delete(instrument.id)
      console.error(`[MarketDataWorker] Instrument ${instrument.instrument_key} errored after ${MAX_RETRIES} retries: ${msg}`)
    } else {
      console.warn(`[MarketDataWorker] Retry ${retries}/${MAX_RETRIES} for ${instrument.instrument_key}`)
    }
  }

  timer = setTimeout(() => tick(deps), deps.delayMs)
}

export function startDownloadWorker(overrides?: Partial<WorkerDeps>): void {
  if (running) return
  running = true
  const deps = { ...DEFAULT_DEPS, ...overrides }
  console.log('[MarketDataWorker] Started')
  tick(deps)
}

export function stopDownloadWorker(): void {
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  retryCounts.clear()
  console.log('[MarketDataWorker] Stopped')
}

export function isWorkerRunning(): boolean {
  return running
}
