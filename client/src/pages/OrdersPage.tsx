import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useOrderHistoryQuery } from '@/lib/upstox-queries'

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status?.toLowerCase()
  if (s === 'complete' || s === 'traded') return 'default'
  if (s === 'rejected' || s === 'cancelled') return 'destructive'
  if (s === 'open' || s === 'pending') return 'secondary'
  return 'outline'
}

export function OrdersPage() {
  const { data: orders = [], isPending, isError, error, refetch, isFetching } =
    useOrderHistoryQuery()

  let body: React.ReactNode

  if (isPending) {
    body = (
      <Card>
        <CardContent className="space-y-2 pt-6">
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
          Failed to load orders:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </CardContent>
      </Card>
    )
  } else if (orders.length === 0) {
    body = (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No orders found
        </CardContent>
      </Card>
    )
  } else {
    body = (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.order_id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {o.order_timestamp
                      ? new Date(o.order_timestamp).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {o.trading_symbol}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {o.exchange}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.order_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        o.transaction_type === 'BUY' ? 'default' : 'destructive'
                      }
                    >
                      {o.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right">
                    {o.price?.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <AppShell title="Orders">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
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
