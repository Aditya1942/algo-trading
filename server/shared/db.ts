// server/shared/db.ts
import { Database } from "bun:sqlite"

const db = new Database("algo.db")

db.run(`
  CREATE TABLE IF NOT EXISTS tokens (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    INTEGER NOT NULL
  )
`)

export default db
