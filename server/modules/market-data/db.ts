// server/modules/market-data/db.ts
import defaultDb from '../../shared/db'
import type { Database } from 'bun:sqlite'
import type { TrackedInstrument, CandleRow, InstrumentWithStats } from './types'

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

// --- Next active instrument for worker ---

export function getNextActiveInstrument(db: Database = defaultDb): TrackedInstrument | null {
  return db.query(
    "SELECT * FROM tracked_instruments WHERE status = 'active' ORDER BY updated_at ASC LIMIT 1",
  ).get() as TrackedInstrument | null
}
