import { useState, useEffect } from 'react'
import { Search, Copy, Check } from 'lucide-react'
import { useInstrumentSearchQuery } from '@/lib/upstox-queries'
import { AppShell } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={handleCopy}
    >
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

export function InstrumentsPage() {
  const [input, setInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(input.trim()), 300)
    return () => clearTimeout(timer)
  }, [input])

  const { data, isPending, isError, error } =
    useInstrumentSearchQuery(debouncedQuery)

  const showSkeleton = isPending && debouncedQuery.length >= 2
  const showEmpty =
    !isPending && !isError && data?.length === 0 && debouncedQuery.length >= 2
  const showResults = !isPending && !isError && data && data.length > 0
  const showPrompt = debouncedQuery.length < 2

  return (
    <AppShell title="Instruments">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Instrument Search
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search Upstox instruments to find instrument keys
        </p>
      </div>

      <div className="relative mt-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search instruments (e.g. RELIANCE, NIFTY)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mt-4">
        {showPrompt && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search instruments
              </p>
            </CardContent>
          </Card>
        )}

        {showSkeleton && <ResultsSkeleton />}

        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-destructive">
                Search failed
              </p>
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
                {data.length} instrument{data.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
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
                      <TableCell className="font-mono text-xs">
                        {inst.instrument_key}
                      </TableCell>
                      <TableCell className="font-medium">
                        {inst.trading_symbol}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inst.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inst.exchange}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{inst.instrument_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <CopyButton text={inst.instrument_key} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
