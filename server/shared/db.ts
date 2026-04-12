// server/shared/db.ts
import { Database } from "bun:sqlite"
import { join } from "path"

const DB_PATH = join(import.meta.dir, "..", "algo.db")
const db = new Database(DB_PATH)

db.run("PRAGMA journal_mode=WAL")

db.run(`
  CREATE TABLE IF NOT EXISTS tokens (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    INTEGER NOT NULL
  )
`)

export default db
