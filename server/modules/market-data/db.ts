// server/modules/market-data/db.ts
import defaultDb from '../../shared/db'
import type { Database } from 'bun:sqlite'
import type { TrackedInstrument, CandleRow, InstrumentWithStats, StoredInstrument } from './types'

const TARGET_START = '2020-01-01'

// --- Schema ---

defaultDb.run(`
  CREATE TABLE IF NOT EXISTS tracked_instruments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_key   TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL DEFAULT '',
    exchange         TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','paused','completed','error')),
    earliest_fetched TEXT,
    latest_fetched   TEXT,
    error_message    TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

defaultDb.run(`
  CREATE TABLE IF NOT EXISTS candles (
    instrument_key TEXT    NOT NULL,
    timestamp      TEXT    NOT NULL,
    open           REAL    NOT NULL,
    high           REAL    NOT NULL,
    low            REAL    NOT NULL,
    close          REAL    NOT NULL,
    volume         INTEGER NOT NULL,
    oi             INTEGER NOT NULL DEFAULT 0,
    UNIQUE(instrument_key, timestamp)
  )
`)

defaultDb.run(`
  CREATE INDEX IF NOT EXISTS idx_candles_key_ts
    ON candles(instrument_key, timestamp)
`)

defaultDb.run(`
  CREATE TABLE IF NOT EXISTS instruments (
    instrument_key  TEXT PRIMARY KEY,
    trading_symbol  TEXT NOT NULL DEFAULT '',
    name            TEXT NOT NULL DEFAULT '',
    exchange        TEXT NOT NULL DEFAULT '',
    instrument_type TEXT NOT NULL DEFAULT '',
    raw_data        TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// --- Instrument CRUD ---

export function listInstruments(db: Database = defaultDb): TrackedInstrument[] {
  return db.query('SELECT * FROM tracked_instruments ORDER BY created_at DESC').all() as TrackedInstrument[]
}

export function getInstrument(id: number, db: Database = defaultDb): TrackedInstrument | null {
  return db.query('SELECT * FROM tracked_instruments WHERE id = ?').get(id) as TrackedInstrument | null
}

export function getInstrumentByKey(key: string, db: Database = defaultDb): TrackedInstrument | null {
  return db.query('SELECT * FROM tracked_instruments WHERE instrument_key = ?').get(key) as TrackedInstrument | null
}

export function addInstrument(
  instrumentKey: string,
  name: string = '',
  exchange: string = '',
  db: Database = defaultDb,
): TrackedInstrument {
  db.run(
    'INSERT INTO tracked_instruments (instrument_key, name, exchange) VALUES (?, ?, ?)',
    [instrumentKey, name, exchange],
  )
  return getInstrumentByKey(instrumentKey, db)!
}

export function removeInstrument(id: number, db: Database = defaultDb): void {
  const txn = db.transaction(() => {
    const inst = getInstrument(id, db)
    if (!inst) return
    db.run('DELETE FROM candles WHERE instrument_key = ?', [inst.instrument_key])
    db.run('DELETE FROM tracked_instruments WHERE id = ?', [id])
  })
  txn()
}

export function updateInstrumentStatus(
  id: number,
  status: string,
  db: Database = defaultDb,
): void {
  db.run(
    "UPDATE tracked_instruments SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, id],
  )
}

export function updateInstrumentProgress(
  id: number,
  earliest: string | null,
  latest: string | null,
  db: Database = defaultDb,
): void {
  db.run(
    `UPDATE tracked_instruments
     SET earliest_fetched = ?,
         latest_fetched = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [earliest, latest, id],
  )
}

export function updateInstrumentError(
  id: number,
  message: string,
  db: Database = defaultDb,
): void {
  db.run(
    "UPDATE tracked_instruments SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?",
    [message, id],
  )
}

// --- Candle operations ---

export function insertCandles(candles: CandleRow[], db: Database = defaultDb): number {
  if (candles.length === 0) return 0
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO candles
       (instrument_key, timestamp, open, high, low, close, volume, oi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  let inserted = 0
  const txn = db.transaction(() => {
    for (const c of candles) {
      const result = stmt.run(c.instrument_key, c.timestamp, c.open, c.high, c.low, c.close, c.volume, c.oi)
      if (result.changes > 0) inserted++
    }
  })
  txn()
  return inserted
}

export function queryCandles(
  instrumentKey: string,
  from: string,
  to: string,
  db: Database = defaultDb,
): CandleRow[] {
  return db.query(
    `SELECT * FROM candles
     WHERE instrument_key = ? AND timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC`,
  ).all(instrumentKey, from, to) as CandleRow[]
}

export function queryCandlesAggregated(
  instrumentKey: string,
  from: string,
  to: string,
  interval: '1d' | '1h' | '1m',
  db: Database = defaultDb,
): CandleRow[] {
  if (interval === '1m') return queryCandles(instrumentKey, from, to, db)

  const groupExpr = interval === '1d' ? 'substr(timestamp, 1, 10)' : 'substr(timestamp, 1, 13)'

  return db.query(
    `WITH bounds AS (
      SELECT instrument_key, ${groupExpr} as bucket,
        MIN(timestamp) as first_ts, MAX(timestamp) as last_ts,
        MAX(high) as high, MIN(low) as low,
        SUM(volume) as volume, MAX(oi) as oi
      FROM candles
      WHERE instrument_key = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY instrument_key, ${groupExpr}
    )
    SELECT b.instrument_key, b.bucket as timestamp,
      first_c.open, b.high, b.low, last_c.close,
      b.volume, b.oi
    FROM bounds b
    JOIN candles first_c ON first_c.instrument_key = b.instrument_key
      AND first_c.timestamp = b.first_ts
    JOIN candles last_c ON last_c.instrument_key = b.instrument_key
      AND last_c.timestamp = b.last_ts
    ORDER BY b.bucket ASC`,
  ).all(instrumentKey, from, to) as CandleRow[]
}

export function countCandles(instrumentKey: string, db: Database = defaultDb): number {
  const row = db.query(
    'SELECT COUNT(*) as cnt FROM candles WHERE instrument_key = ?',
  ).get(instrumentKey) as { cnt: number }
  return row.cnt
}

export function deleteInstrumentCandles(instrumentKey: string, db: Database = defaultDb): void {
  db.run('DELETE FROM candles WHERE instrument_key = ?', [instrumentKey])
}

// --- Stats ---

export function listInstrumentsWithStats(db: Database = defaultDb): InstrumentWithStats[] {
  const instruments = listInstruments(db)
  return instruments.map((inst) => {
    const candle_count = countCandles(inst.instrument_key, db)

    let progress_pct = 0
    if (inst.status === 'completed') {
      progress_pct = 100
    } else if (inst.earliest_fetched && inst.latest_fetched) {
      const earliest = new Date(inst.earliest_fetched).getTime()
      const latest = new Date(inst.latest_fetched).getTime()
      const target = new Date(TARGET_START).getTime()
      const totalRange = latest - target
      const coveredRange = latest - earliest
      progress_pct = totalRange > 0
        ? Math.min(100, Math.round((coveredRange / totalRange) * 100))
        : 0
    }

    return { ...inst, candle_count, progress_pct }
  })
}

// --- Instruments cache ---

export function upsertInstruments(
  instruments: Array<{
    instrument_key: string
    trading_symbol: string
    name: string
    exchange: string
    instrument_type: string
    raw_data: string
  }>,
  db: Database = defaultDb,
): number {
  if (instruments.length === 0) return 0
  const stmt = db.prepare(
    `INSERT INTO instruments (instrument_key, trading_symbol, name, exchange, instrument_type, raw_data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(instrument_key) DO UPDATE SET
       trading_symbol = excluded.trading_symbol,
       name = excluded.name,
       exchange = excluded.exchange,
       instrument_type = excluded.instrument_type,
       raw_data = excluded.raw_data,
       updated_at = datetime('now')`,
  )
  let count = 0
  const txn = db.transaction(() => {
    for (const i of instruments) {
      stmt.run(i.instrument_key, i.trading_symbol, i.name, i.exchange, i.instrument_type, i.raw_data)
      count++
    }
  })
  txn()
  return count
}

export function searchStoredInstruments(
  search: string,
  page: number,
  limit: number,
  db: Database = defaultDb,
): { data: StoredInstrument[]; total: number } {
  const offset = (page - 1) * limit
  const pattern = `%${search}%`

  if (search.length === 0) {
    const total = (db.query('SELECT COUNT(*) as cnt FROM instruments').get() as { cnt: number }).cnt
    const data = db.query(
      'SELECT * FROM instruments ORDER BY trading_symbol ASC LIMIT ? OFFSET ?',
    ).all(limit, offset) as StoredInstrument[]
    return { data, total }
  }

  const total = (db.query(
    `SELECT COUNT(*) as cnt FROM instruments
     WHERE trading_symbol LIKE ? OR name LIKE ? OR instrument_key LIKE ?`,
  ).get(pattern, pattern, pattern) as { cnt: number }).cnt

  const data = db.query(
    `SELECT * FROM instruments
     WHERE trading_symbol LIKE ? OR name LIKE ? OR instrument_key LIKE ?
     ORDER BY trading_symbol ASC LIMIT ? OFFSET ?`,
  ).all(pattern, pattern, pattern, limit, offset) as StoredInstrument[]

  return { data, total }
}

export function countStoredInstruments(db: Database = defaultDb): number {
  return (db.query('SELECT COUNT(*) as cnt FROM instruments').get() as { cnt: number }).cnt
}

// --- Next active instrument for worker ---

export function listTrackedInstrumentKeys(db: Database = defaultDb): string[] {
  const rows = db.query('SELECT instrument_key FROM tracked_instruments').all() as { instrument_key: string }[]
  return rows.map(r => r.instrument_key)
}

export function getNextActiveInstrument(db: Database = defaultDb): TrackedInstrument | null {
  return db.query(
    "SELECT * FROM tracked_instruments WHERE status = 'active' ORDER BY updated_at ASC LIMIT 1",
  ).get() as TrackedInstrument | null
}
