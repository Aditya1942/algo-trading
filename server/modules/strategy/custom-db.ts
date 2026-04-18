import defaultDb from "../../shared/db.ts";
import type { Database } from "bun:sqlite";
import type { StrategyParamSpec } from "../../shared/contracts/index.ts";

export interface CustomStrategyRow {
  id: number;
  name: string;
  description: string;
  code: string;
  paramSpecs: StrategyParamSpec[];
  supportedIntervals: ("1d" | "1h" | "1m")[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomStrategyInput {
  name: string;
  description?: string;
  code: string;
  paramSpecs?: StrategyParamSpec[];
  supportedIntervals?: ("1d" | "1h" | "1m")[];
}

defaultDb.run(`
  CREATE TABLE IF NOT EXISTS custom_strategies (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL UNIQUE,
    description           TEXT NOT NULL DEFAULT '',
    code                  TEXT NOT NULL,
    param_specs           TEXT NOT NULL DEFAULT '[]',
    supported_intervals   TEXT NOT NULL DEFAULT '["1d","1h","1m"]',
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

interface RawRow {
  id: number;
  name: string;
  description: string;
  code: string;
  param_specs: string;
  supported_intervals: string;
  created_at: string;
  updated_at: string;
}

function hydrate(row: RawRow): CustomStrategyRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    paramSpecs: JSON.parse(row.param_specs) as StrategyParamSpec[],
    supportedIntervals: JSON.parse(row.supported_intervals) as ("1d" | "1h" | "1m")[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCustom(input: CustomStrategyInput, db: Database = defaultDb): CustomStrategyRow {
  const stmt = db.prepare(`
    INSERT INTO custom_strategies (name, description, code, param_specs, supported_intervals)
    VALUES (?, ?, ?, ?, ?)
  `);
  const run = stmt.run(
    input.name,
    input.description ?? "",
    input.code,
    JSON.stringify(input.paramSpecs ?? []),
    JSON.stringify(input.supportedIntervals ?? ["1d", "1h", "1m"]),
  );
  const id = Number(run.lastInsertRowid);
  return getCustom(id, db)!;
}

export function updateCustom(
  id: number,
  patch: Partial<CustomStrategyInput>,
  db: Database = defaultDb,
): CustomStrategyRow | null {
  const existing = getCustom(id, db);
  if (!existing) return null;

  const name = patch.name ?? existing.name;
  const description = patch.description ?? existing.description;
  const code = patch.code ?? existing.code;
  const paramSpecs = patch.paramSpecs ?? existing.paramSpecs;
  const supportedIntervals = patch.supportedIntervals ?? existing.supportedIntervals;

  db.prepare(`
    UPDATE custom_strategies
    SET name = ?, description = ?, code = ?, param_specs = ?, supported_intervals = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name,
    description,
    code,
    JSON.stringify(paramSpecs),
    JSON.stringify(supportedIntervals),
    id,
  );

  return getCustom(id, db);
}

export function deleteCustom(id: number, db: Database = defaultDb): boolean {
  const run = db.prepare("DELETE FROM custom_strategies WHERE id = ?").run(id);
  return run.changes > 0;
}

export function getCustom(id: number, db: Database = defaultDb): CustomStrategyRow | null {
  const row = db
    .query("SELECT * FROM custom_strategies WHERE id = ?")
    .get(id) as RawRow | null;
  return row ? hydrate(row) : null;
}

export function getCustomByName(name: string, db: Database = defaultDb): CustomStrategyRow | null {
  const row = db
    .query("SELECT * FROM custom_strategies WHERE name = ?")
    .get(name) as RawRow | null;
  return row ? hydrate(row) : null;
}

export function listCustom(db: Database = defaultDb): CustomStrategyRow[] {
  const rows = db
    .query("SELECT * FROM custom_strategies ORDER BY updated_at DESC")
    .all() as RawRow[];
  return rows.map(hydrate);
}
