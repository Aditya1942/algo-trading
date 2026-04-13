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
  db.run(`
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
  upsertInstruments,
  searchStoredInstruments,
  countStoredInstruments,
  listTrackedInstrumentKeys,
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

  test("listTrackedInstrumentKeys returns keys of all tracked instruments", () => {
    addInstrument("NSE_EQ|INE848E01016", "HDFC", "NSE", db)
    addInstrument("NSE_EQ|INE002A01018", "RELIANCE", "NSE", db)
    const keys = listTrackedInstrumentKeys(db)
    expect(keys.length).toBe(2)
    expect(keys).toContain("NSE_EQ|INE848E01016")
    expect(keys).toContain("NSE_EQ|INE002A01018")
  })

  test("listTrackedInstrumentKeys returns empty array when no instruments", () => {
    const keys = listTrackedInstrumentKeys(db)
    expect(keys).toEqual([])
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

// --- Instruments cache ---

describe("instruments cache", () => {
  test("upsertInstruments inserts new instruments", () => {
    const db = createTestDb()
    const count = upsertInstruments([
      { instrument_key: "NSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
      { instrument_key: "NSE_EQ|INE009A01021", trading_symbol: "INFY", name: "Infosys", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
    ], db)
    expect(count).toBe(2)
    const { data, total } = searchStoredInstruments("", 1, 50, db)
    expect(total).toBe(2)
    expect(data.length).toBe(2)
  })

  test("upsertInstruments updates existing on conflict", () => {
    const db = createTestDb()
    upsertInstruments([
      { instrument_key: "NSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Old Name", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
    ], db)
    upsertInstruments([
      { instrument_key: "NSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", instrument_type: "EQUITY", raw_data: '{"updated":true}' },
    ], db)
    const { data, total } = searchStoredInstruments("", 1, 50, db)
    expect(total).toBe(1)
    expect(data[0].name).toBe("Reliance Industries")
  })

  test("searchStoredInstruments filters by search term", () => {
    const db = createTestDb()
    upsertInstruments([
      { instrument_key: "NSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
      { instrument_key: "NSE_EQ|INE009A01021", trading_symbol: "INFY", name: "Infosys", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
      { instrument_key: "BSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Reliance Industries", exchange: "BSE", instrument_type: "EQUITY", raw_data: "{}" },
    ], db)
    const { data, total } = searchStoredInstruments("RELIANCE", 1, 50, db)
    expect(total).toBe(2)
    expect(data.every(d => d.trading_symbol === "RELIANCE")).toBe(true)
  })

  test("searchStoredInstruments paginates correctly", () => {
    const db = createTestDb()
    const instruments = Array.from({ length: 25 }, (_, i) => ({
      instrument_key: `NSE_EQ|KEY${String(i).padStart(3, "0")}`,
      trading_symbol: `SYM${String(i).padStart(3, "0")}`,
      name: `Name ${i}`,
      exchange: "NSE",
      instrument_type: "EQUITY",
      raw_data: "{}",
    }))
    upsertInstruments(instruments, db)
    const page1 = searchStoredInstruments("", 1, 10, db)
    expect(page1.data.length).toBe(10)
    expect(page1.total).toBe(25)
    const page3 = searchStoredInstruments("", 3, 10, db)
    expect(page3.data.length).toBe(5)
    expect(page3.total).toBe(25)
  })

  test("countStoredInstruments returns total count", () => {
    const db = createTestDb()
    expect(countStoredInstruments(db)).toBe(0)
    upsertInstruments([
      { instrument_key: "NSE_EQ|INE002A01018", trading_symbol: "RELIANCE", name: "Reliance", exchange: "NSE", instrument_type: "EQUITY", raw_data: "{}" },
    ], db)
    expect(countStoredInstruments(db)).toBe(1)
  })
})
