import { test, expect, beforeEach, describe } from "bun:test"
import { Database } from "bun:sqlite"
import type { CandleRow } from "./types"

// Create in-memory DB with same schema
function createTestDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA journal_mode=WAL")
  db.run(`
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
  db.run(`
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
  db.run("CREATE INDEX IF NOT EXISTS idx_candles_key_ts ON candles(instrument_key, timestamp)")
  return db
}

// Import functions that accept db parameter
import {
  listInstruments,
  getInstrument,
  getInstrumentByKey,
  addInstrument,
  removeInstrument,
  updateInstrumentStatus,
  updateInstrumentProgress,
  updateInstrumentError,
  insertCandles,
  queryCandles,
  countCandles,
  deleteInstrumentCandles,
  listInstrumentsWithStats,
  getNextActiveInstrument,
} from "./db"

let db: Database

beforeEach(() => {
  db = createTestDb()
})

// --- Instrument CRUD ---

describe("instruments", () => {
  test("addInstrument creates and returns instrument", () => {
    const inst = addInstrument("NSE_EQ|INE848E01016", "HDFC", "NSE", db)
    expect(inst.instrument_key).toBe("NSE_EQ|INE848E01016")
    expect(inst.name).toBe("HDFC")
    expect(inst.exchange).toBe("NSE")
    expect(inst.status).toBe("active")
    expect(inst.earliest_fetched).toBeNull()
    expect(inst.latest_fetched).toBeNull()
  })

  test("addInstrument duplicate throws", () => {
    addInstrument("NSE_EQ|INE848E01016", "HDFC", "NSE", db)
    expect(() => addInstrument("NSE_EQ|INE848E01016", "HDFC2", "NSE", db)).toThrow()
  })

  test("listInstruments returns all", () => {
    addInstrument("KEY1", "A", "", db)
    addInstrument("KEY2", "B", "", db)
    const list = listInstruments(db)
    expect(list.length).toBe(2)
  })

  test("getInstrument by id", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    const found = getInstrument(inst.id, db)
    expect(found).not.toBeNull()
    expect(found!.instrument_key).toBe("KEY1")
  })

  test("getInstrument returns null for missing id", () => {
    expect(getInstrument(999, db)).toBeNull()
  })

  test("getInstrumentByKey works", () => {
    addInstrument("KEY1", "A", "", db)
    const found = getInstrumentByKey("KEY1", db)
    expect(found).not.toBeNull()
    expect(found!.name).toBe("A")
  })

  test("removeInstrument deletes instrument and its candles", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    insertCandles([makeCandle("KEY1", "2024-01-01T09:15:00+05:30")], db)
    expect(countCandles("KEY1", db)).toBe(1)

    removeInstrument(inst.id, db)
    expect(getInstrument(inst.id, db)).toBeNull()
    expect(countCandles("KEY1", db)).toBe(0)
  })

  test("updateInstrumentStatus changes status", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    updateInstrumentStatus(inst.id, "paused", db)
    expect(getInstrument(inst.id, db)!.status).toBe("paused")
  })

  test("updateInstrumentProgress sets dates", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    updateInstrumentProgress(inst.id, "2023-01-01", "2024-06-01", db)
    const updated = getInstrument(inst.id, db)!
    expect(updated.earliest_fetched).toBe("2023-01-01")
    expect(updated.latest_fetched).toBe("2024-06-01")
  })

  test("updateInstrumentError sets error status and message", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    updateInstrumentError(inst.id, "rate limited", db)
    const updated = getInstrument(inst.id, db)!
    expect(updated.status).toBe("error")
    expect(updated.error_message).toBe("rate limited")
  })

  test("getNextActiveInstrument picks oldest updated_at", () => {
    addInstrument("KEY1", "A", "", db)
    addInstrument("KEY2", "B", "", db)
    // KEY1 was inserted first, so has oldest updated_at
    const next = getNextActiveInstrument(db)
    expect(next).not.toBeNull()
    expect(next!.instrument_key).toBe("KEY1")
  })

  test("getNextActiveInstrument returns null when none active", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    updateInstrumentStatus(inst.id, "paused", db)
    expect(getNextActiveInstrument(db)).toBeNull()
  })
})

// --- Candle operations ---

function makeCandle(key: string, ts: string, open = 100): CandleRow {
  return {
    instrument_key: key,
    timestamp: ts,
    open,
    high: open + 5,
    low: open - 3,
    close: open + 1,
    volume: 1000,
    oi: 0,
  }
}

describe("candles", () => {
  test("insertCandles stores candles", () => {
    const candles = [
      makeCandle("KEY1", "2024-01-01T09:15:00+05:30"),
      makeCandle("KEY1", "2024-01-01T09:16:00+05:30"),
    ]
    const inserted = insertCandles(candles, db)
    expect(inserted).toBe(2)
    expect(countCandles("KEY1", db)).toBe(2)
  })

  test("insertCandles deduplicates via INSERT OR IGNORE", () => {
    const c = makeCandle("KEY1", "2024-01-01T09:15:00+05:30")
    insertCandles([c], db)
    const inserted = insertCandles([c], db)
    expect(inserted).toBe(0)
    expect(countCandles("KEY1", db)).toBe(1)
  })

  test("insertCandles with empty array returns 0", () => {
    expect(insertCandles([], db)).toBe(0)
  })

  test("queryCandles filters by date range", () => {
    insertCandles([
      makeCandle("KEY1", "2024-01-01T09:15:00+05:30"),
      makeCandle("KEY1", "2024-01-02T09:15:00+05:30"),
      makeCandle("KEY1", "2024-01-03T09:15:00+05:30"),
    ], db)
    const result = queryCandles("KEY1", "2024-01-01", "2024-01-02T23:59:59", db)
    expect(result.length).toBe(2)
  })

  test("queryCandles returns ordered by timestamp", () => {
    insertCandles([
      makeCandle("KEY1", "2024-01-02T09:15:00+05:30"),
      makeCandle("KEY1", "2024-01-01T09:15:00+05:30"),
    ], db)
    const result = queryCandles("KEY1", "2024-01-01", "2024-12-31", db)
    expect(result[0].timestamp).toBe("2024-01-01T09:15:00+05:30")
    expect(result[1].timestamp).toBe("2024-01-02T09:15:00+05:30")
  })

  test("deleteInstrumentCandles removes all candles for key", () => {
    insertCandles([
      makeCandle("KEY1", "2024-01-01T09:15:00+05:30"),
      makeCandle("KEY2", "2024-01-01T09:15:00+05:30"),
    ], db)
    deleteInstrumentCandles("KEY1", db)
    expect(countCandles("KEY1", db)).toBe(0)
    expect(countCandles("KEY2", db)).toBe(1)
  })
})

// --- Stats ---

describe("listInstrumentsWithStats", () => {
  test("includes candle_count and progress_pct", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    insertCandles([
      makeCandle("KEY1", "2024-01-01T09:15:00+05:30"),
      makeCandle("KEY1", "2024-01-02T09:15:00+05:30"),
    ], db)
    updateInstrumentProgress(inst.id, "2023-01-01", "2024-06-01", db)

    const stats = listInstrumentsWithStats(db)
    expect(stats.length).toBe(1)
    expect(stats[0].candle_count).toBe(2)
    expect(stats[0].progress_pct).toBeGreaterThan(0)
    expect(stats[0].progress_pct).toBeLessThanOrEqual(100)
  })

  test("completed instrument has 100% progress", () => {
    const inst = addInstrument("KEY1", "A", "", db)
    updateInstrumentStatus(inst.id, "completed", db)
    const stats = listInstrumentsWithStats(db)
    expect(stats[0].progress_pct).toBe(100)
  })

  test("no progress when nothing fetched", () => {
    addInstrument("KEY1", "A", "", db)
    const stats = listInstrumentsWithStats(db)
    expect(stats[0].progress_pct).toBe(0)
    expect(stats[0].candle_count).toBe(0)
  })
})
