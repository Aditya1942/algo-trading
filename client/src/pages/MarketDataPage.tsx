import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Plus,
  Pause,
  Play,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import {
  useTrackedInstrumentsQuery,
  useAddInstrumentMutation,
  useDeleteInstrumentMutation,
  usePauseInstrumentMutation,
  useResumeInstrumentMutation,
} from '@/lib/market-data-queries'
import { useStoredInstrumentsQuery } from '@/lib/upstox-queries'
import type { TrackedInstrument, StoredInstrument } from '@/lib/api'

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  active: {
    label: 'Downloading',
    variant: 'default',
    icon: <Download className="h-3 w-3" />,
  },
  paused: {
    label: 'Paused',
    variant: 'secondary',
    icon: <Pause className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  error: {
    label: 'Error',
    variant: 'destructive',
    icon: <AlertCircle className="h-3 w-3" />,
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.error
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

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

function DeleteConfirmDialog({
  instrument,
  children,
}: {
  instrument: TrackedInstrument
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const deleteMutation = useDeleteInstrumentMutation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Instrument</DialogTitle>
          <DialogDescription>
            This will permanently delete{' '}
            <strong>{instrument.name || instrument.instrument_key}</strong> and all{' '}
            {formatNumber(instrument.candle_count)} downloaded candles. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteMutation.mutate(instrument.id, { onSuccess: () => setOpen(false) })
            }
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InstrumentActions({ instrument }: { instrument: TrackedInstrument }) {
  const pauseMutation = usePauseInstrumentMutation()
  const resumeMutation = useResumeInstrumentMutation()

  const canPause = instrument.status === 'active'
  const canResume = instrument.status === 'paused' || instrument.status === 'error'

  return (
    <div className="flex items-center gap-1">
      {canPause && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Pause"
          disabled={pauseMutation.isPending}
          onClick={() => pauseMutation.mutate(instrument.id)}
        >
          <Pause className="h-4 w-4" />
        </Button>
      )}
      {canResume && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Resume"
          disabled={resumeMutation.isPending}
          onClick={() => resumeMutation.mutate(instrument.id)}
        >
          <Play className="h-4 w-4" />
        </Button>
      )}
      <DeleteConfirmDialog instrument={instrument}>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DeleteConfirmDialog>
    </div>
  )
}

function InstrumentTable({ instruments, onInstrumentClick }: { instruments: TrackedInstrument[]; onInstrumentClick: (id: number) => void }) {
  if (instruments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Database className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>No instruments tracked yet</p>
          <p className="mt-1 text-sm">Add an instrument to start downloading historical data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instrument</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[200px]">Progress</TableHead>
            <TableHead className="text-right">Candles</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instruments.map((inst) => (
            <TableRow
              key={inst.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => onInstrumentClick(inst.id)}
            >
              <TableCell>
                <div>
                  <div className="font-medium">
                    {inst.name || inst.instrument_key}
                  </div>
                  {inst.name && (
                    <div className="text-xs text-muted-foreground">{inst.instrument_key}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={inst.status} />
                {inst.status === 'error' && inst.error_message && (
                  <p className="mt-1 text-xs text-destructive">{inst.error_message}</p>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={inst.progress_pct} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {inst.progress_pct}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatNumber(inst.candle_count)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {inst.earliest_fetched && inst.latest_fetched
                  ? `${inst.earliest_fetched} to ${inst.latest_fetched}`
                  : 'Not started'}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <InstrumentActions instrument={inst} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export function MarketDataPage() {
  const navigate = useNavigate()
  const { data: instruments = [], isPending, isError, error } = useTrackedInstrumentsQuery()

  const totalCandles = instruments.reduce((sum, i) => sum + i.candle_count, 0)
  const activeCount = instruments.filter((i) => i.status === 'active').length
  const completedCount = instruments.filter((i) => i.status === 'completed').length

  let body: React.ReactNode

  if (isPending) {
    body = (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  } else if (isError) {
    body = (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load instruments: {(error as Error)?.message ?? 'Unknown error'}
        </CardContent>
      </Card>
    )
  } else {
    body = (
      <>
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Instruments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{instruments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Candles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalCandles)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Downloads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeCount} active
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  / {completedCount} done
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <InstrumentTable instruments={instruments} onInstrumentClick={(id) => navigate(`/market-data/${id}/chart`)} />
      </>
    )
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Market Data</h1>
          <AddInstrumentDialog />
        </div>
        {body}
      </div>
    </AppShell>
  )
}
