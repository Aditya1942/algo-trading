import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { useHoldingsQuery } from '@/lib/upstox-queries'

export function HoldingsPage() {
  const { data: holdings = [], isPending, isError, error, refetch, isFetching } =
    useHoldingsQuery()

  let body: React.ReactNode

  if (isPending) {
    body = (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  } else if (isError) {
    body = (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load holdings:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </CardContent>
      </Card>
    )
  } else if (holdings.length === 0) {
    body = (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No holdings found
        </CardContent>
      </Card>
    )
  } else {
    const totalPnl = holdings.reduce((sum, h) => sum + (h.pnl ?? 0), 0)
    body = (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Holdings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{holdings.length}</span>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {totalPnl >= 0 ? '+' : ''}
                {totalPnl.toFixed(2)}
              </span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="text-right">LTP</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">Day Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={h.isin || h.trading_symbol}>
                    <TableCell className="font-medium">
                      <div>
                        {h.trading_symbol}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {h.exchange}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.company_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{h.quantity}</TableCell>
                    <TableCell className="text-right">
                      {h.average_price?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {h.last_price?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          (h.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {(h.pnl ?? 0) >= 0 ? (
                          <TrendingUp className="mr-1 inline size-3" />
                        ) : (
                          <TrendingDown className="mr-1 inline size-3" />
                        )}
                        {h.pnl?.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          (h.day_change_percentage ?? 0) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {h.day_change_percentage?.toFixed(2)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AppShell title="Holdings">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holdings</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className="mr-1 size-4" />
          Refresh
        </Button>
      </div>
      <div className="mt-4">{body}</div>
    </AppShell>
  )
}
