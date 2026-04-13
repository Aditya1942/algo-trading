// server/modules/market-data/types.ts

export interface TrackedInstrument {
  id: number
  instrument_key: string
  name: string
  exchange: string
  status: 'active' | 'paused' | 'completed' | 'error'
  earliest_fetched: string | null  // ISO date YYYY-MM-DD
  latest_fetched: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface CandleRow {
  instrument_key: string
  timestamp: string       // ISO 8601 from Upstox
  open: number
  high: number
  low: number
  close: number
  volume: number
  oi: number
}

export interface InstrumentWithStats extends TrackedInstrument {
  candle_count: number
  progress_pct: number   // 0-100
}

export interface UpstoxCandleResponse {
  status: string
  data: {
    candles: [string, number, number, number, number, number, number][]
    // [timestamp, open, high, low, close, volume, oi]
  }
}
