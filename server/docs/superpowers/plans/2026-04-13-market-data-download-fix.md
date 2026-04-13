# Market Data Download Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect instruments cache to market-data download so users can add instruments with correct Upstox key format, either via a Download button on the Instruments page or autocomplete in the Add Instrument dialog.

**Architecture:** Add one new server endpoint (`GET /api/v1/market-data/instruments/keys`) returning tracked instrument keys. Client uses this to show download buttons vs status badges on stored instruments rows, and to power autocomplete in the Add Instrument dialog.

**Tech Stack:** Bun, SQLite (bun:sqlite), React, TanStack Query, shadcn/ui

**Spec:** `server/docs/superpowers/specs/2026-04-13-market-data-download-fix.md`

---

### Task 1: Server — `listTrackedInstrumentKeys` DB function + test

**Files:**
- Modify: `server/modules/market-data/db.ts` (add function at bottom)
- Modify: `server/modules/market-data/index.ts` (add export)
- Modify: `server/modules/market-data/db.test.ts` (add test)

- [ ] **Step 1: Write failing test in `db.test.ts`**

Add at the end of the test file:

```typescript
import { listTrackedInstrumentKeys } from './db'

// ... inside existing describe or at top level:

test('listTrackedInstrumentKeys returns keys of all tracked instruments', () => {
  // db is the test in-memory database — follow existing test pattern
  addInstrument('NSE_EQ|INE001A01036', 'HDFC Bank', 'NSE', db)
  addInstrument('NSE_EQ|INF204KB17I5', 'GOLDBEES', 'NSE', db)

  const keys = listTrackedInstrumentKeys(db)
  expect(keys).toContain('NSE_EQ|INE001A01036')
  expect(keys).toContain('NSE_EQ|INF204KB17I5')
  expect(keys).toHaveLength(2)
})

test('listTrackedInstrumentKeys returns empty array when no instruments', () => {
  const keys = listTrackedInstrumentKeys(db)
  expect(keys).toEqual([])
})
```

Note: check existing test file for exact `db` variable name and import pattern — tests use in-memory SQLite. Add `listTrackedInstrumentKeys` to the import from `./db`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && bun test modules/market-data/db.test.ts`
Expected: FAIL — `listTrackedInstrumentKeys` is not exported

- [ ] **Step 3: Implement `listTrackedInstrumentKeys` in `db.ts`**

Add at end of file, before the `getNextActiveInstrument` function:

```typescript
export function listTrackedInstrumentKeys(db: Database = defaultDb): string[] {
  const rows = db.query('SELECT instrument_key FROM tracked_instruments').all() as { instrument_key: string }[]
  return rows.map(r => r.instrument_key)
}
```

- [ ] **Step 4: Export from `index.ts`**

Add `listTrackedInstrumentKeys` to the exports from `./db` in `server/modules/market-data/index.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && bun test modules/market-data/db.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/modules/market-data/db.ts server/modules/market-data/db.test.ts server/modules/market-data/index.ts
git commit -m "feat(market-data): add listTrackedInstrumentKeys DB function"
```

---

### Task 2: Server — API endpoint `GET /api/v1/market-data/instruments/keys`

**Files:**
- Modify: `server/api/market-data.ts` (add handler)
- Modify: `server/index.ts` (register route)

- [ ] **Step 1: Add handler in `api/market-data.ts`**

Add import for `listTrackedInstrumentKeys` from `../modules/market-data`, then add handler:

```typescript
// GET /api/v1/market-data/instruments/keys
export async function handleGetTrackedKeys(_req: Request): Promise<Response> {
  const keys = listTrackedInstrumentKeys()
  return Response.json({ data: keys })
}
```

- [ ] **Step 2: Register route in `server/index.ts`**

Add import for `handleGetTrackedKeys` from `./api/market-data`.

In the static routes object, add under the existing market-data section:

```typescript
"/api/v1/market-data/instruments/keys": {
  GET: L((req) => handleGetTrackedKeys(req)),
},
```

Place it BEFORE the `/api/v1/market-data/instruments` entry (more specific routes first).

- [ ] **Step 3: Verify endpoint works**

Start server: `cd server && bun --hot run index.ts`

```bash
curl -s http://localhost:8081/api/v1/market-data/instruments/keys | python3 -m json.tool
```

Expected: `{ "data": [] }` (or list of keys if any tracked instruments exist)

- [ ] **Step 4: Commit**

```bash
git add server/api/market-data.ts server/index.ts
git commit -m "feat(api): add GET /market-data/instruments/keys endpoint"
```

---

### Task 3: Client — API function + query hook for tracked keys

**Files:**
- Modify: `client/src/lib/api.ts` (add fetch function)
- Modify: `client/src/lib/market-data-queries.ts` (add query key + hook)

- [ ] **Step 1: Add `getTrackedInstrumentKeys` to `api.ts`**

In the Market Data section of `client/src/lib/api.ts`, add:

```typescript
export async function getTrackedInstrumentKeys(): Promise<string[]> {
  return marketDataFetch<string[]>('/instruments/keys')
}
```

- [ ] **Step 2: Add query key and hook to `market-data-queries.ts`**

Add key to `marketDataKeys`:

```typescript
export const marketDataKeys = {
  all: ['market-data'] as const,
  instruments: () => [...marketDataKeys.all, 'instruments'] as const,
  trackedKeys: () => [...marketDataKeys.all, 'tracked-keys'] as const,
}
```

Add hook:

```typescript
import {
  getTrackedInstruments,
  addTrackedInstrument,
  deleteTrackedInstrument,
  pauseInstrument,
  resumeInstrument,
  getTrackedInstrumentKeys,
} from '@/lib/api'

export function useTrackedInstrumentKeysQuery() {
  return useQuery({
    queryKey: marketDataKeys.trackedKeys(),
    queryFn: getTrackedInstrumentKeys,
  })
}
```

Also update `useAddInstrumentMutation` to invalidate tracked keys on success:

```typescript
export function useAddInstrumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { instrumentKey: string; name?: string; exchange?: string }) =>
      addTrackedInstrument(vars.instrumentKey, vars.name, vars.exchange),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketDataKeys.instruments() })
      qc.invalidateQueries({ queryKey: marketDataKeys.trackedKeys() })
    },
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api.ts client/src/lib/market-data-queries.ts
git commit -m "feat(client): add tracked instrument keys query hook"
```

---

### Task 4: Client — Download button on Instruments page stored tab

**Files:**
- Modify: `client/src/pages/InstrumentsPage.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports in `InstrumentsPage.tsx`:

```typescript
import { Download, Loader2 } from 'lucide-react'
import {
  useTrackedInstrumentKeysQuery,
  useAddInstrumentMutation,
} from '@/lib/market-data-queries'
```

Also add `Badge` to the status display (already imported).

- [ ] **Step 2: Create `DownloadButton` component**

Add above `InstrumentsTable`:

```typescript
const downloadStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Downloading', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'outline' },
  error: { label: 'Error', variant: 'destructive' },
}
```

Note: The tracked keys endpoint only returns keys (strings), not statuses. To show status badges, we need the full tracked instruments data. Update approach: use `useTrackedInstrumentsQuery` from market-data-queries (which returns full instrument objects with status) instead of just keys. Build a `Map<string, TrackedInstrument>` for lookup.

Replace the keys approach with full tracked instruments:

```typescript
import {
  useTrackedInstrumentsQuery,
  useAddInstrumentMutation,
} from '@/lib/market-data-queries'
import type { TrackedInstrument } from '@/lib/api'
```

Remove the `useTrackedInstrumentKeysQuery` import (keys-only endpoint still useful for other consumers but not needed here).

- [ ] **Step 3: Modify `InstrumentsTable` to accept tracked instruments map and add Download column**

Update the component signature and add a column:

```typescript
function InstrumentsTable({
  data,
  trackedMap,
}: {
  data: Array<{ instrument_key: string; trading_symbol: string; name: string; exchange: string; instrument_type: string }>
  trackedMap?: Map<string, TrackedInstrument>
}) {
  const addMutation = useAddInstrumentMutation()

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
          {trackedMap && <TableHead className="w-28">Download</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((inst) => {
          const tracked = trackedMap?.get(inst.instrument_key)
          return (
            <TableRow key={inst.instrument_key}>
              <TableCell className="font-mono text-xs">{inst.instrument_key}</TableCell>
              <TableCell className="font-medium">{inst.trading_symbol}</TableCell>
              <TableCell className="text-muted-foreground">{inst.name}</TableCell>
              <TableCell><Badge variant="secondary">{inst.exchange}</Badge></TableCell>
              <TableCell><Badge variant="outline">{inst.instrument_type}</Badge></TableCell>
              <TableCell><CopyButton text={inst.instrument_key} /></TableCell>
              {trackedMap && (
                <TableCell>
                  {tracked ? (
                    <Badge variant={downloadStatusMap[tracked.status]?.variant ?? 'outline'}>
                      {downloadStatusMap[tracked.status]?.label ?? tracked.status}
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate({
                        instrumentKey: inst.instrument_key,
                        name: inst.name || inst.trading_symbol,
                        exchange: inst.exchange,
                      })}
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                      ) : (
                        <Download className="size-3.5 mr-1" />
                      )}
                      Download
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Update `StoredInstrumentsTab` to pass tracked map**

Inside `StoredInstrumentsTab`, add the query and build the map:

```typescript
function StoredInstrumentsTab() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: countData } = useStoredInstrumentsCountQuery()
  const { data, isPending, isError, error } = useStoredInstrumentsQuery(debouncedSearch, page)
  const { data: trackedInstruments = [] } = useTrackedInstrumentsQuery()

  const trackedMap = new Map(trackedInstruments.map(t => [t.instrument_key, t]))
  const totalCount = countData ?? 0

  // ... rest same, but pass trackedMap to InstrumentsTable:
  // <InstrumentsTable data={data.data} trackedMap={trackedMap} />
```

Update the `<InstrumentsTable data={data.data} />` call to `<InstrumentsTable data={data.data} trackedMap={trackedMap} />`.

The `UpstoxSearchTab` calls `<InstrumentsTable data={data} />` without `trackedMap` — no changes needed there (no Download column in search results).

- [ ] **Step 5: Verify it compiles and renders**

Run: `cd client && npx tsc --noEmit`

Then open browser, go to Instruments page → Stored tab. Should see Download buttons on each row.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/InstrumentsPage.tsx
git commit -m "feat(instruments): add download button on stored instruments rows"
```

---

### Task 5: Client — Autocomplete in AddInstrumentDialog

**Files:**
- Modify: `client/src/pages/MarketDataPage.tsx`

- [ ] **Step 1: Add imports and state for autocomplete**

Add to imports:

```typescript
import { useStoredInstrumentsQuery } from '@/lib/upstox-queries'
import type { StoredInstrument } from '@/lib/api'
```

- [ ] **Step 2: Rewrite `AddInstrumentDialog` with autocomplete**

Replace the existing `AddInstrumentDialog` function:

```typescript
function AddInstrumentDialog() {
  const [open, setOpen] = useState(false)
  const [instrumentKey, setInstrumentKey] = useState('')
  const [name, setName] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const addMutation = useAddInstrumentMutation()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: searchResults } = useStoredInstrumentsQuery(debouncedSearch, 1)
  const suggestions = debouncedSearch.length >= 2 ? (searchResults?.data ?? []) : []

  function handleSelect(inst: StoredInstrument) {
    setInstrumentKey(inst.instrument_key)
    setName(inst.name || inst.trading_symbol)
    setSearchInput(inst.trading_symbol)
    setShowDropdown(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!instrumentKey.trim()) return
    addMutation.mutate(
      { instrumentKey: instrumentKey.trim(), name: name.trim() || undefined },
      {
        onSuccess: () => {
          setInstrumentKey('')
          setName('')
          setSearchInput('')
          setOpen(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Instrument
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Instrument</DialogTitle>
            <DialogDescription>
              Search for an instrument or enter the Upstox instrument key directly.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {/* Search / autocomplete */}
            <div className="relative">
              <label className="text-sm font-medium" htmlFor="instrument-search">
                Search Instrument
              </label>
              <Input
                id="instrument-search"
                placeholder="Search by symbol or name..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                autoFocus
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((inst) => (
                    <button
                      key={inst.instrument_key}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex justify-between items-center"
                      onClick={() => handleSelect(inst)}
                    >
                      <span>
                        <span className="font-medium">{inst.trading_symbol}</span>
                        <span className="ml-2 text-muted-foreground">{inst.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{inst.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Instrument key (auto-filled or manual) */}
            <div>
              <label className="text-sm font-medium" htmlFor="instrument-key">
                Instrument Key *
              </label>
              <Input
                id="instrument-key"
                placeholder="NSE_EQ|INE848E01016"
                value={instrumentKey}
                onChange={(e) => setInstrumentKey(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="instrument-name">
                Name (optional)
              </label>
              <Input
                id="instrument-name"
                placeholder="HDFC Bank"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          {addMutation.isError && (
            <p className="mt-2 text-sm text-destructive">
              {(addMutation.error as Error)?.message ?? 'Failed to add instrument'}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={addMutation.isPending || !instrumentKey.trim()}>
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Add `useEffect` import if not present**

Check top of file — `useState` is already imported. Add `useEffect`:

```typescript
import { useState, useEffect } from 'react'
```

- [ ] **Step 4: Verify it compiles and renders**

Run: `cd client && npx tsc --noEmit`

Open browser → Market Data page → click "Add Instrument" → type "GOLD" → dropdown should show GOLDBEES → select → instrument_key auto-filled with `NSE_EQ|INF204KB17I5`.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/MarketDataPage.tsx
git commit -m "feat(market-data): add autocomplete to Add Instrument dialog"
```

---

### Task 6: Manual end-to-end test

- [ ] **Step 1: Clean up any test data**

```bash
sqlite3 server/algo.db "DELETE FROM tracked_instruments WHERE instrument_key = 'INF204KB17I5';"
```

- [ ] **Step 2: Test Download button flow**

1. Open browser → Instruments page → Stored tab
2. Find GOLDBEES row → click Download button
3. Go to Market Data page → verify GOLDBEES appears with status "Downloading" and `instrument_key` = `NSE_EQ|INF204KB17I5`
4. Wait a few seconds — verify candle count increases (worker fetching with correct key)

- [ ] **Step 3: Test autocomplete flow**

1. Market Data page → click "Add Instrument"
2. Type "GOLD" in search field
3. Verify dropdown shows GOLDBEES
4. Select it → verify instrument_key field shows `NSE_EQ|INF204KB17I5`
5. Click Add

- [ ] **Step 4: Verify worker downloads with correct key**

```bash
sqlite3 server/algo.db "SELECT instrument_key, status, earliest_fetched, latest_fetched FROM tracked_instruments;"
sqlite3 server/algo.db "SELECT COUNT(*) FROM candles WHERE instrument_key = 'NSE_EQ|INF204KB17I5';"
```

Expected: status = 'active', candle count > 0

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "chore: cleanup after manual e2e test"
```
