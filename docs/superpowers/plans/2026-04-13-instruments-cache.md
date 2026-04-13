# Instruments Cache + Local Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache all Upstox instrument search results in SQLite and add a paginated local browse tab (default) alongside existing Upstox live search.

**Architecture:** New `instruments` table in market-data module. Server intercepts Upstox search responses to bulk-upsert. New `/api/v1/instruments/stored` endpoint for paginated local search. Client InstrumentsPage gets two tabs: "Stored" (default) and "Upstox Search".

**Tech Stack:** Bun + SQLite (bun:sqlite), React + shadcn/ui Tabs, React Query

---

### Task 1: Add `instruments` Table to market-data DB

**Files:**
- Modify: `server/modules/market-data/db.ts` (add schema + CRUD functions)
- Modify: `server/modules/market-data/types.ts` (add StoredInstrument type)
- Modify: `server/modules/market-data/db.test.ts` (add tests)

- [ ] **Step 1: Add StoredInstrument type**

In `server/modules/market-data/types.ts`, add:

```typescript
export interface StoredInstrument {
  instrument_key: string
  trading_symbol: string
  name: string
  exchange: string
  instrument_type: string
  raw_data: string           // JSON string of full Upstox response
  created_at: string
  updated_at: string
}

export interface StoredInstrumentsPage {
  data: StoredInstrument[]
  total: number
  page: number
  totalPages: number
}
```

- [ ] **Step 2: Add schema creation in db.ts**

In `server/modules/market-data/db.ts`, after the existing `CREATE INDEX` for candles (line 43), add:

```typescript
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
```

- [ ] **Step 3: Add DB functions for instruments cache**

In `server/modules/market-data/db.ts`, add these functions:

```typescript
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
```

Import `StoredInstrument` at the top of db.ts:
```typescript
import type { TrackedInstrument, CandleRow, InstrumentWithStats, StoredInstrument } from './types'
```

- [ ] **Step 4: Export new functions from module index**

In `server/modules/market-data/index.ts`, add exports:

```typescript
export { upsertInstruments, searchStoredInstruments, countStoredInstruments } from './db'
```

- [ ] **Step 5: Write tests for instruments cache DB functions**

In `server/modules/market-data/db.test.ts`, the `createTestDb()` function creates an in-memory DB. Add the `instruments` table to it:

```typescript
// Inside createTestDb(), after the candles index creation:
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
```

Then add a new describe block:

```typescript
describe('instruments cache', () => {
  test('upsertInstruments inserts new instruments', () => {
    const db = createTestDb()
    const count = upsertInstruments([
      { instrument_key: 'NSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
      { instrument_key: 'NSE_EQ|INE009A01021', trading_symbol: 'INFY', name: 'Infosys', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
    ], db)
    expect(count).toBe(2)
    const { data, total } = searchStoredInstruments('', 1, 50, db)
    expect(total).toBe(2)
    expect(data.length).toBe(2)
  })

  test('upsertInstruments updates existing on conflict', () => {
    const db = createTestDb()
    upsertInstruments([
      { instrument_key: 'NSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Old Name', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
    ], db)
    upsertInstruments([
      { instrument_key: 'NSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{"updated":true}' },
    ], db)
    const { data, total } = searchStoredInstruments('', 1, 50, db)
    expect(total).toBe(1)
    expect(data[0].name).toBe('Reliance Industries')
  })

  test('searchStoredInstruments filters by search term', () => {
    const db = createTestDb()
    upsertInstruments([
      { instrument_key: 'NSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
      { instrument_key: 'NSE_EQ|INE009A01021', trading_symbol: 'INFY', name: 'Infosys', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
      { instrument_key: 'BSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'BSE', instrument_type: 'EQUITY', raw_data: '{}' },
    ], db)
    const { data, total } = searchStoredInstruments('RELIANCE', 1, 50, db)
    expect(total).toBe(2)
    expect(data.every(d => d.trading_symbol === 'RELIANCE')).toBe(true)
  })

  test('searchStoredInstruments paginates correctly', () => {
    const db = createTestDb()
    const instruments = Array.from({ length: 25 }, (_, i) => ({
      instrument_key: `NSE_EQ|KEY${String(i).padStart(3, '0')}`,
      trading_symbol: `SYM${String(i).padStart(3, '0')}`,
      name: `Name ${i}`,
      exchange: 'NSE',
      instrument_type: 'EQUITY',
      raw_data: '{}',
    }))
    upsertInstruments(instruments, db)
    const page1 = searchStoredInstruments('', 1, 10, db)
    expect(page1.data.length).toBe(10)
    expect(page1.total).toBe(25)
    const page3 = searchStoredInstruments('', 3, 10, db)
    expect(page3.data.length).toBe(5)
    expect(page3.total).toBe(25)
  })

  test('countStoredInstruments returns total count', () => {
    const db = createTestDb()
    expect(countStoredInstruments(db)).toBe(0)
    upsertInstruments([
      { instrument_key: 'NSE_EQ|INE002A01018', trading_symbol: 'RELIANCE', name: 'Reliance', exchange: 'NSE', instrument_type: 'EQUITY', raw_data: '{}' },
    ], db)
    expect(countStoredInstruments(db)).toBe(1)
  })
})
```

- [ ] **Step 6: Run tests**

Run: `cd server && bun test modules/market-data/db.test.ts`
Expected: All tests pass including new instruments cache tests.

- [ ] **Step 7: Commit**

```bash
git add server/modules/market-data/db.ts server/modules/market-data/types.ts server/modules/market-data/db.test.ts server/modules/market-data/index.ts
git commit -m "feat: add instruments cache table and DB functions"
```

---

### Task 2: Server — Intercept Search + Add Stored Endpoints

**Files:**
- Modify: `server/api/instruments.ts` (intercept Upstox response, cache results)
- Create: `server/api/stored-instruments.ts` (new paginated endpoint)
- Modify: `server/index.ts` (register new route)

- [ ] **Step 1: Modify handleSearchInstruments to cache results**

Replace `server/api/instruments.ts` with:

```typescript
// server/api/instruments.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { upsertInstruments } from "../modules/market-data"

// --- GET /api/v1/upstox/instruments/search ---
export async function handleSearchInstruments(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const result = await upstoxGet(forwardQuery("/instruments/search", req)) as {
      status: string
      data: Array<{
        instrument_key: string
        trading_symbol?: string
        name?: string
        exchange?: string
        instrument_type?: string
        [key: string]: unknown
      }>
    }

    // Cache results in background — don't block response
    if (result?.data?.length > 0) {
      try {
        upsertInstruments(
          result.data.map((inst) => ({
            instrument_key: inst.instrument_key,
            trading_symbol: inst.trading_symbol ?? '',
            name: inst.name ?? '',
            exchange: inst.exchange ?? '',
            instrument_type: inst.instrument_type ?? '',
            raw_data: JSON.stringify(inst),
          })),
        )
      } catch {
        // Don't fail the search if caching fails
        console.error('[instruments] cache upsert failed')
      }
    }

    return Response.json(result)
  } catch (err) {
    const { AuthError, UpstoxError } = await import("../shared/types")
    if (err instanceof AuthError)
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    if (err instanceof UpstoxError)
      return Response.json(err.body, { status: err.status })
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create stored-instruments.ts API handler**

Create `server/api/stored-instruments.ts`:

```typescript
// server/api/stored-instruments.ts — paginated local instrument search
import { searchStoredInstruments, countStoredInstruments } from '../modules/market-data'

// GET /api/v1/instruments/stored?search=&page=1&limit=50
export async function handleGetStoredInstruments(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')))

  const { data, total } = searchStoredInstruments(search, page, limit)
  const totalPages = Math.ceil(total / limit)

  return Response.json({
    data,
    total,
    page,
    totalPages,
  })
}

// GET /api/v1/instruments/stored/count
export async function handleGetStoredInstrumentsCount(_req: Request): Promise<Response> {
  const total = countStoredInstruments()
  return Response.json({ total })
}
```

- [ ] **Step 3: Register new routes in server/index.ts**

Add import at top of `server/index.ts` (after the instruments import on line 46):

```typescript
import { handleGetStoredInstruments, handleGetStoredInstrumentsCount } from "./api/stored-instruments"
```

Add route entries inside `Bun.serve({ routes: { ... } })`, after the instruments search route (line 143):

```typescript
    // --- Stored instruments (local cache) ---
    "/api/v1/instruments/stored":       { GET: L((req) => handleGetStoredInstruments(req)) },
    "/api/v1/instruments/stored/count": { GET: L((req) => handleGetStoredInstrumentsCount(req)) },
```

- [ ] **Step 4: Run server tests**

Run: `cd server && bun test`
Expected: All existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/api/instruments.ts server/api/stored-instruments.ts server/index.ts
git commit -m "feat: cache Upstox search results + add stored instruments endpoints"
```

---

### Task 3: Client — API Functions + Query Hooks

**Files:**
- Modify: `client/src/lib/api.ts` (add stored instruments fetch functions)
- Modify: `client/src/lib/upstox-query-keys.ts` (add stored instruments key)
- Modify: `client/src/lib/upstox-queries.ts` (add stored instruments hook)

- [ ] **Step 1: Add StoredInstrument types and API functions to api.ts**

In `client/src/lib/api.ts`, after the `searchInstruments` function (line 148), add:

```typescript
// --- Stored Instruments (local cache) ---

const INSTRUMENTS_API = `${API_V1}/instruments`

export interface StoredInstrument {
  instrument_key: string
  trading_symbol: string
  name: string
  exchange: string
  instrument_type: string
  raw_data: string
  created_at: string
  updated_at: string
}

export interface StoredInstrumentsResponse {
  data: StoredInstrument[]
  total: number
  page: number
  totalPages: number
}

export async function getStoredInstruments(
  search: string,
  page: number,
  limit: number = 50,
): Promise<StoredInstrumentsResponse> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  })
  const res = await fetch(`${INSTRUMENTS_API}/stored?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  return res.json()
}

export async function getStoredInstrumentsCount(): Promise<number> {
  const res = await fetch(`${INSTRUMENTS_API}/stored/count`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body)
  }
  const json = await res.json()
  return json.total
}
```

- [ ] **Step 2: Add query keys**

In `client/src/lib/upstox-query-keys.ts`, add a new key group after `upstoxKeys`:

```typescript
export const instrumentsKeys = {
  all: ['instruments'] as const,
  stored: (search: string, page: number) => [...instrumentsKeys.all, 'stored', search, page] as const,
  storedCount: () => [...instrumentsKeys.all, 'stored-count'] as const,
}
```

- [ ] **Step 3: Add query hooks**

In `client/src/lib/upstox-queries.ts`, add imports for the new API functions and keys:

At the top, update imports:
```typescript
import {
  ApiError,
  getFundsAndMargin,
  getHoldings,
  getOrderHistory,
  getUserProfile,
  logout,
  searchInstruments,
  getStoredInstruments,
  getStoredInstrumentsCount,
} from '@/lib/api'
import { upstoxKeys, instrumentsKeys } from '@/lib/upstox-query-keys'
```

Then add hooks at the bottom (before `useLogoutMutation`):

```typescript
export function useStoredInstrumentsQuery(search: string, page: number) {
  return useQuery({
    queryKey: instrumentsKeys.stored(search, page),
    queryFn: () => getStoredInstruments(search, page),
  })
}

export function useStoredInstrumentsCountQuery() {
  return useQuery({
    queryKey: instrumentsKeys.storedCount(),
    queryFn: getStoredInstrumentsCount,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api.ts client/src/lib/upstox-query-keys.ts client/src/lib/upstox-queries.ts
git commit -m "feat: add client API functions and hooks for stored instruments"
```

---

### Task 4: Client — Rewrite InstrumentsPage with Tabs

**Files:**
- Modify: `client/src/pages/InstrumentsPage.tsx` (add tabs, stored instruments tab as default)

- [ ] **Step 1: Rewrite InstrumentsPage.tsx**

Replace entire `client/src/pages/InstrumentsPage.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import { Search, Copy, Check, Database, Globe, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useInstrumentSearchQuery,
  useStoredInstrumentsQuery,
  useStoredInstrumentsCountQuery,
} from '@/lib/upstox-queries'
import { AppShell } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function InstrumentsTable({ data }: { data: Array<{ instrument_key: string; trading_symbol: string; name: string; exchange: string; instrument_type: string }> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Instrument Key</TableHead>
          <TableHead>Symbol</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Exchange</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((inst) => (
          <TableRow key={inst.instrument_key}>
            <TableCell className="font-mono text-xs">{inst.instrument_key}</TableCell>
            <TableCell className="font-medium">{inst.trading_symbol}</TableCell>
            <TableCell className="text-muted-foreground">{inst.name}</TableCell>
            <TableCell><Badge variant="secondary">{inst.exchange}</Badge></TableCell>
            <TableCell><Badge variant="outline">{inst.instrument_type}</Badge></TableCell>
            <TableCell><CopyButton text={inst.instrument_key} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StoredInstrumentsTab() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1) // reset page on search change
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: countData } = useStoredInstrumentsCountQuery()
  const { data, isPending, isError, error } = useStoredInstrumentsQuery(debouncedSearch, page)

  const totalCount = countData ?? 0

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search stored instruments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isPending && <ResultsSkeleton />}

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">Failed to load instruments</p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && data && (
        <>
          {data.data.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Database className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {totalCount === 0
                    ? 'No instruments stored yet. Search via Upstox to populate.'
                    : `No results for "${debouncedSearch}"`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Stored Instruments</CardTitle>
                <CardDescription>
                  {data.total} instrument{data.total !== 1 ? 's' : ''} found
                  {debouncedSearch && ` matching "${debouncedSearch}"`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <InstrumentsTable data={data.data} />
              </CardContent>
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function UpstoxSearchTab() {
  const [input, setInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(input.trim()), 300)
    return () => clearTimeout(timer)
  }, [input])

  const { data, isPending, isError, error } = useInstrumentSearchQuery(debouncedQuery)

  const showSkeleton = isPending && debouncedQuery.length >= 2
  const showEmpty = !isPending && !isError && data?.length === 0 && debouncedQuery.length >= 2
  const showResults = !isPending && !isError && data && data.length > 0
  const showPrompt = debouncedQuery.length < 2

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search instruments (e.g. RELIANCE, NIFTY)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {showPrompt && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to search Upstox instruments
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Results are automatically saved to local database
            </p>
          </CardContent>
        </Card>
      )}

      {showSkeleton && <ResultsSkeleton />}

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">Search failed</p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      )}

      {showEmpty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No instruments found for "{debouncedQuery}"
            </p>
          </CardContent>
        </Card>
      )}

      {showResults && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Results</CardTitle>
            <CardDescription>
              {data.length} instrument{data.length !== 1 ? 's' : ''} found — saved to local DB
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <InstrumentsTable data={data} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function InstrumentsPage() {
  const { data: countData } = useStoredInstrumentsCountQuery()
  const totalCount = countData ?? 0

  return (
    <AppShell title="Instruments">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instruments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse stored instruments or search Upstox live
        </p>
      </div>

      <Tabs defaultValue="stored" className="mt-4">
        <TabsList>
          <TabsTrigger value="stored" className="gap-2">
            <Database className="size-4" />
            Stored
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {totalCount.toLocaleString()}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upstox" className="gap-2">
            <Globe className="size-4" />
            Upstox Search
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stored" className="mt-4">
          <StoredInstrumentsTab />
        </TabsContent>
        <TabsContent value="upstox" className="mt-4">
          <UpstoxSearchTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/InstrumentsPage.tsx
git commit -m "feat: instruments page with stored/upstox search tabs"
```

---

### Task 5: Integration Test + Smoke Check

- [ ] **Step 1: Run all server tests**

Run: `cd server && bun test`
Expected: All tests pass.

- [ ] **Step 2: Run client build**

Run: `cd client && bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev` from root.

1. Open http://localhost:3000, navigate to Instruments page
2. Default tab = "Stored" — shows empty state initially
3. Switch to "Upstox Search" tab, search "RELIANCE"
4. Results appear, switch back to "Stored" tab
5. Refresh — RELIANCE instruments now in stored tab
6. Test pagination by searching more terms to build up DB
7. Test local search filtering on stored tab

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: instruments cache — store Upstox search results with local browse"
```
