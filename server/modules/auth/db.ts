import { Database } from "bun:sqlite"
import _db from "../../shared/db"
import type { Token } from "../../shared/types"

export function getToken(db: Database = _db): Token | null {
  return db.query("SELECT id, access_token, refresh_token, expires_at FROM tokens WHERE id = 1").get() as Token | null
}

export function upsertToken(token: Omit<Token, "id">, db: Database = _db): void {
  db.run(
    `INSERT INTO tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at    = excluded.expires_at`,
    [token.access_token, token.refresh_token ?? null, token.expires_at]
  )
}
