import type { Database } from 'bun:sqlite'
import defaultDb from '../../shared/db.ts'
import type { RiskRejectCode, RiskState } from './types.ts'

export interface PersistedRiskEvent {
  strategyRunId: number
  rejectCode: RiskRejectCode
  rejectReason?: string
  signalAction?: 'BUY' | 'SELL'
  signalQuantity?: number
  riskState: RiskState | string
}

export interface RiskEventRow {
  id: number
  strategy_run_id: number
  reject_code: RiskRejectCode
  reject_reason: string | null
  signal_action: 'BUY' | 'SELL' | null
  signal_quantity: number | null
  risk_state: string
  created_at: string
}

export function ensureRiskTables(db: Database = defaultDb): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS risk_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_run_id INTEGER REFERENCES strategy_runs(id),
      reject_code     TEXT NOT NULL,
      reject_reason   TEXT,
      signal_action   TEXT,
      signal_quantity INTEGER,
      risk_state      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `)
}

ensureRiskTables(defaultDb)

export function saveRiskEvents(events: PersistedRiskEvent[], db: Database = defaultDb): void {
  if (events.length === 0) {
    return
  }

  ensureRiskTables(db)

  const stmt = db.prepare(`
    INSERT INTO risk_events (
      strategy_run_id,
      reject_code,
      reject_reason,
      signal_action,
      signal_quantity,
      risk_state
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const event of events) {
      stmt.run(
        event.strategyRunId,
        event.rejectCode,
        event.rejectReason ?? null,
        event.signalAction ?? null,
        event.signalQuantity ?? null,
        typeof event.riskState === 'string' ? event.riskState : JSON.stringify(event.riskState),
      )
    }
  })

  transaction()
}

export function listRiskEventsForRun(strategyRunId: number, db: Database = defaultDb): RiskEventRow[] {
  ensureRiskTables(db)

  return db.query(`
    SELECT
      id,
      strategy_run_id,
      reject_code,
      reject_reason,
      signal_action,
      signal_quantity,
      risk_state,
      created_at
    FROM risk_events
    WHERE strategy_run_id = ?
    ORDER BY id ASC
  `).all(strategyRunId) as RiskEventRow[]
}
