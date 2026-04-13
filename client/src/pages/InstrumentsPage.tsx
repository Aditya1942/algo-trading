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
