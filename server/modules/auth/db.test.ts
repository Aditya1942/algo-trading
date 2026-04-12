import { test, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { clearToken, getToken, upsertToken } from "./db"

function makeTestDb(): Database {
  const db = new Database(":memory:")
  db.run(`
    CREATE TABLE tokens (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    INTEGER NOT NULL
    )
  `)
  return db
}

let db: Database

beforeEach(() => {
  db = makeTestDb()
})

test("getToken returns null when no token stored", () => {
  expect(getToken(db)).toBeNull()
})

test("upsertToken stores token and getToken retrieves it", () => {
  upsertToken({ access_token: "tok_abc", refresh_token: "ref_xyz", expires_at: 9999999 }, db)
  const t = getToken(db)
  expect(t).not.toBeNull()
  expect(t!.access_token).toBe("tok_abc")
  expect(t!.refresh_token).toBe("ref_xyz")
  expect(t!.expires_at).toBe(9999999)
})

test("upsertToken overwrites existing token", () => {
  upsertToken({ access_token: "tok_old", refresh_token: null, expires_at: 1000 }, db)
  upsertToken({ access_token: "tok_new", refresh_token: "ref_new", expires_at: 2000 }, db)
  const t = getToken(db)
  expect(t!.access_token).toBe("tok_new")
  expect(t!.expires_at).toBe(2000)
})

test("upsertToken handles null refresh_token", () => {
  upsertToken({ access_token: "tok", refresh_token: null, expires_at: 5000 }, db)
  const t = getToken(db)
  expect(t!.refresh_token).toBeNull()
})

test("clearToken removes stored token", () => {
  upsertToken({ access_token: "tok", refresh_token: "ref", expires_at: 5000 }, db)
  expect(getToken(db)).not.toBeNull()
  clearToken(db)
  expect(getToken(db)).toBeNull()
})
