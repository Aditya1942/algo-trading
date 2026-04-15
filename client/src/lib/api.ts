const API_V1 = '/api/v1'
const UPSTOX_API = `${API_V1}/upstox`

class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API error ${status}`)
    this.status = status
    this.body = body
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${UPSTOX_API}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  return res.json()
}

// --- Auth ---

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_V1}/health`)
    return res.ok
  } catch {
    return false
  }
}

/** Redirect browser to Upstox OAuth login */
export function redirectToLogin() {
  window.location.href = '/auth/login'
}

/** Clears server-side OAuth tokens (POST /api/v1/upstox/auth/logout). */
export async function logout(): Promise<void> {
  await fetch(`${UPSTOX_API}/auth/logout`, { method: 'POST' })
}

// --- User Profile ---

export interface UserProfile {
  email: string
  user_name: string
  user_id: string
  broker: string
  exchanges: string[]
  products: string[]
  is_active: boolean
  [key: string]: unknown
}

export async function getUserProfile(): Promise<UserProfile> {
  const res = await apiFetch<{ status: string; data: UserProfile }>(
    '/user/profile',
  )
  return res.data
}

// --- Funds & margin (Upstox v3 passthrough `data`) ---

export type FundsAndMargin = Record<string, unknown>

export async function getFundsAndMargin(): Promise<FundsAndMargin> {
  const res = await apiFetch<{ status: string; data: FundsAndMargin }>(
    '/user/funds-and-margin',
  )
  return res.data
}

// --- Holdings ---

export interface Holding {
  isin: string
  company_name: string
  quantity: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
  exchange: string
  trading_symbol: string
  [key: string]: unknown
}

export async function getHoldings(): Promise<Holding[]> {
  const res = await apiFetch<{ status: string; data: Holding[] }>(
    '/portfolio/holdings',
  )
  return res.data ?? []
}

// --- Orders ---

export interface Order {
  order_id: string
  exchange_order_id: string
  order_type: string
  transaction_type: string
  trading_symbol: string
  instrument_token: string
  quantity: number
  price: number
  trigger_price: number
  status: string
  order_timestamp: string
  exchange: string
  [key: string]: unknown
}

export async function getOrderHistory(): Promise<Order[]> {
  const res = await apiFetch<{ status: string; data: Order[] }>(
    '/order/history',
  )
  return res.data ?? []
}

// --- Instrument Search ---

export interface InstrumentSearchResult {
  instrument_key: string
  name: string
  trading_symbol: string
  exchange: string
  instrument_type: string
  [key: string]: unknown
}

export async function searchInstruments(
  query: string,
): Promise<InstrumentSearchResult[]> {
  const res = await fetch(
    `${UPSTOX_API}/instruments/search?query=${encodeURIComponent(query)}`,
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  const json = await res.json()
  return json.data ?? []
}

// --- Stored Instruments (local cache) ---

const INSTRUMENTS_API = `${API_V1}/instruments`

export interface StoredInstrument {
  instrument_key: string
  trading_symbol: string
  name: string
  exchange: string
  instrument_type: string
  raw_data: string
  created_at: string
  updated_at: string
}

export interface StoredInstrumentsResponse {
  data: StoredInstrument[]
  total: number
  page: number
  totalPages: number
}

export async function getStoredInstruments(
  search: string,
  page: number,
  limit: number = 50,
): Promise<StoredInstrumentsResponse> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  })
  const res = await fetch(`${INSTRUMENTS_API}/stored?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  return res.json()
}

export async function getStoredInstrumentsCount(): Promise<number> {
  const res = await fetch(`${INSTRUMENTS_API}/stored/count`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  const json = await res.json()
  return json.total
}

// --- Market Data ---

const MARKET_DATA_API = `${API_V1}/market-data`

export interface TrackedInstrument {
  id: number
  instrument_key: string
  name: string
  exchange: string
  status: 'active' | 'paused' | 'completed' | 'error'
  earliest_fetched: string | null
  latest_fetched: string | null
  error_message: string | null
  candle_count: number
  progress_pct: number
  created_at: string
  updated_at: string
}

async function marketDataFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${MARKET_DATA_API}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  const json = await res.json()
  return json.data ?? json
}

export async function getTrackedInstruments(): Promise<TrackedInstrument[]> {
  return marketDataFetch<TrackedInstrument[]>('/instruments')
}

export async function addTrackedInstrument(
  instrumentKey: string,
  name?: string,
  exchange?: string,
): Promise<TrackedInstrument> {
  return marketDataFetch<TrackedInstrument>('/instruments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument_key: instrumentKey, name, exchange }),
  })
}

export async function deleteTrackedInstrument(id: number): Promise<void> {
  await marketDataFetch(`/instruments/${id}`, { method: 'DELETE' })
}

export async function pauseInstrument(id: number): Promise<void> {
  await marketDataFetch(`/instruments/${id}/pause`, { method: 'POST' })
}

export async function resumeInstrument(id: number): Promise<void> {
  await marketDataFetch(`/instruments/${id}/resume`, { method: 'POST' })
}

export async function getTrackedInstrumentKeys(): Promise<string[]> {
  return marketDataFetch<string[]>('/instruments/keys')
}

// --- Candle Data ---

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
  interval: '1d' | '1h' | '1m' = '1d',
): Promise<CandleData[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  params.set('interval', interval)
  const query = params.toString()
  return marketDataFetch<CandleData[]>(
    `/instruments/${instrumentId}/candles${query ? `?${query}` : ''}`,
  )
}

// --- Backtest ---

const BACKTEST_API = `${API_V1}/backtest`

export interface BacktestConfig {
  mode: 'backtest'
  strategyName: string
  instrumentKey: string
  from: string
  to: string
  interval: '1d' | '1h' | '1m'
  initialBalance: number
  params: Record<string, number>
  risk: RiskLimits
  fo?: FoContractConfig
  slippagePct?: number
}

export interface BacktestTrade {
  action: 'BUY' | 'SELL'
  price: number
  quantity: number
  timestamp: string
  reason: string
  balanceAfter: number
}

export interface BacktestMetrics {
  totalPnl: number
  totalPnlPercent: number
  winRate: number
  totalTrades: number
  avgProfitPerTrade: number
  maxDrawdown: number
  maxDrawdownPercent: number
}

export interface BacktestResult {
  id?: number
  config: BacktestConfig
  trades: BacktestTrade[]
  metrics: BacktestMetrics
  equityCurve: { timestamp: string; equity: number }[]
  createdAt?: string
}

export interface StrategyInfo {
  name: string
  description: string
  defaultParams: Record<string, number>
  paramSpecs?: StrategyParamSpec[]
  supportedIntervals?: ('1d' | '1h' | '1m')[]
  supportedModes?: ('backtest' | 'paper' | 'live')[]
}

export interface StrategyParamSpecOption {
  label: string
  value: number
}

export interface StrategyParamSpec {
  key: string
  label: string
  type: 'number' | 'integer' | 'select'
  required: boolean
  defaultValue: number
  min?: number
  max?: number
  step?: number
  options?: StrategyParamSpecOption[]
  description?: string
  group?: string
}

export interface RiskLimits {
  maxDailyLossPct: number
  maxOpenPositions: number
  maxCapitalPerTradePct: number
  maxStrategyDrawdownPct: number
  maxOrdersPerMinute: number
  killSwitchEnabled: boolean
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLossPct: 3,
  maxOpenPositions: 5,
  maxCapitalPerTradePct: 20,
  maxStrategyDrawdownPct: 15,
  maxOrdersPerMinute: 10,
  killSwitchEnabled: true,
}

export interface FoContractConfig {
  underlying: string
  instrumentType: 'FUT' | 'CE' | 'PE'
  expiryPolicy: 'current_month' | 'next_month' | 'current_week' | 'next_week'
  strikeSelection?: 'atm' | 'otm_1' | 'otm_2' | 'itm_1' | 'itm_2'
  lotMultiplier: number
}

export interface StrategyRunConfig {
  mode: 'backtest' | 'paper' | 'live'
  strategyName: string
  instrumentKey: string
  interval: '1d' | '1h' | '1m'
  from?: string
  to?: string
  initialBalance: number
  params: Record<string, number>
  risk: RiskLimits
  fo?: FoContractConfig
}

export interface BacktestRunSummary {
  id: number
  strategy_name: string
  instrument_key: string
  total_pnl: number
  win_rate: number
  total_trades: number
  created_at: string
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const res = await fetch(`${BACKTEST_API}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  const json = await res.json()
  return json.data
}

export async function getBacktestHistory(): Promise<BacktestRunSummary[]> {
  const res = await fetch(`${BACKTEST_API}/history`)
  if (!res.ok) throw new ApiError(res.status, null)
  const json = await res.json()
  return json.data
}

export async function getBacktestResult(id: number): Promise<BacktestResult> {
  const res = await fetch(`${BACKTEST_API}/history/${id}`)
  if (!res.ok) throw new ApiError(res.status, null)
  const json = await res.json()
  return json.data
}

export async function getStrategies(): Promise<StrategyInfo[]> {
  const res = await fetch(`${API_V1}/strategies`)
  if (!res.ok) throw new ApiError(res.status, null)
  const json = await res.json()
  return json.data
}

export { ApiError }
