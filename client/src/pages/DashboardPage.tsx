import {
  ApiError,
  type FundsAndMargin,
} from '@/lib/api'
import { useFundsAndMarginQuery, useHoldingsQuery } from '@/lib/upstox-queries'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  User,
  Mail,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  TrendingUp,
  Lock,
  ArrowRight,
  Briefcase,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

/* ─── helpers ─── */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

/** Safely dig a numeric value out of a nested unknown object */
function dig(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj
  for (const k of keys) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return 0
    cur = (cur as Record<string, unknown>)[k]
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : 0
}

function humanize(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatQueryError(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object')
    return JSON.stringify(err.body)
  if (err instanceof Error) return err.message
  return 'Failed to load funds'
}

/* ─── small components ─── */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'default'
}) {
  const ring =
    accent === 'green'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : accent === 'red'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-border bg-muted/30'
  const iconColor =
    accent === 'green'
      ? 'text-emerald-500'
      : accent === 'red'
        ? 'text-red-500'
        : 'text-muted-foreground'
  return (
    <Card className={`${ring} border`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 rounded-lg bg-background p-2 shadow-sm ${iconColor}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
          {sub && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  icon: Icon,
  data,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  data: unknown
}) {
  if (!data || typeof data !== 'object') return null
  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([, v]) => typeof v === 'number' && Number.isFinite(v),
  )
  if (entries.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {entries.map(([k, v]) => (
            <InfoRow
              key={k}
              label={humanize(k)}
              value={inr.format(v as number)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── skeletons ─── */

function ProfileSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

function FundsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ─── main ─── */

export function DashboardPage() {
  const { user, refresh, status } = useAuth()
  const navigate = useNavigate()
  const fundsQuery = useFundsAndMarginQuery({
    enabled: status === 'authenticated',
  })
  const holdingsQuery = useHoldingsQuery()
  const funds = fundsQuery.data as FundsAndMargin | undefined
  const fundsPending = fundsQuery.isPending
  const fundsErrorMsg = fundsQuery.isError
    ? formatQueryError(fundsQuery.error)
    : null

  /* extract key figures from funds */
  const totalAvailable = funds ? dig(funds, 'available_to_trade', 'total') : 0
  const cashAvail = funds ? dig(funds, 'available_to_trade', 'cash_available_to_trade', 'cash') : 0
  const pledgeAvail = funds ? dig(funds, 'available_to_trade', 'pledge_available_to_trade', 'margin_from_pledge') : 0
  const cashUnavail = funds ? dig(funds, 'unavailable_to_trade', 'cash_unavailable_to_trade', 'unsettled_profit') : 0

  const shellTitle = user?.user_name ? `Hi, ${user.user_name}` : 'Dashboard'

  return (
    <AppShell title={shellTitle}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Profile, funds, and margin details
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {/* Profile Card */}
      <div className="mt-6">
        {!user ? (
          <ProfileSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {user.user_name || user.email}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Mail className="size-3" />
                    {user.email}
                  </CardDescription>
                </div>
                <div className="ml-auto">
                  <Badge
                    variant={user.is_active ? 'default' : 'destructive'}
                    className="gap-1"
                  >
                    <Shield className="size-3" />
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="grid gap-x-8 gap-y-4 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  User ID
                </p>
                <p className="mt-1 text-sm font-mono">{user.user_id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Broker
                </p>
                <p className="mt-1 text-sm font-medium">{user.broker}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Exchanges
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.exchanges?.map((ex) => (
                    <Badge key={ex} variant="secondary" className="text-xs">
                      {ex}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Products
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.products?.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Funds & Margin Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Funds &amp; Margin</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Real-time account balances from Upstox
        </p>

        {!user || (fundsPending && !funds) ? (
          <FundsSkeleton />
        ) : fundsErrorMsg ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-destructive/10 p-2">
                <Wallet className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">
                  Could not load funds
                </p>
                <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                  {fundsErrorMsg}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : funds ? (
          <div className="space-y-6">
            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={TrendingUp}
                label="Total Available"
                value={inr.format(totalAvailable)}
                sub="Available to trade"
                accent="green"
              />
              <StatCard
                icon={Wallet}
                label="Cash Available"
                value={inr.format(cashAvail)}
                sub="Settled cash balance"
                accent="default"
              />
              <StatCard
                icon={Building2}
                label="Pledge Margin"
                value={inr.format(pledgeAvail)}
                sub="From pledged holdings"
                accent="default"
              />
              <StatCard
                icon={Lock}
                label="Blocked / Unsettled"
                value={inr.format(cashUnavail)}
                sub="Not available to trade"
                accent="red"
              />
            </div>

            {/* Detailed breakdown */}
            <div className="grid gap-4 sm:grid-cols-2">
              <BreakdownCard
                title="Available to Trade"
                icon={ArrowUpRight}
                data={flattenFundsSection(funds.available_to_trade)}
              />
              <BreakdownCard
                title="Unavailable to Trade"
                icon={ArrowDownRight}
                data={flattenFundsSection(funds.unavailable_to_trade)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Top Holdings */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Top Holdings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              By absolute P&amp;L
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/holdings')}
          >
            View All
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>

        <div className="mt-4">
          {holdingsQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : holdingsQuery.isError ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-center gap-3 p-4">
                <Briefcase className="size-4 text-destructive" />
                <p className="text-sm text-destructive">Could not load holdings</p>
              </CardContent>
            </Card>
          ) : holdingsQuery.data && holdingsQuery.data.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Instrument Key</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">P&amp;L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...holdingsQuery.data]
                      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
                      .slice(0, 5)
                      .map((h) => {
                        const instrumentKey = `${h.exchange}|${h.isin}`
                        return (
                          <TableRow key={instrumentKey}>
                            <TableCell className="font-medium">
                              {h.trading_symbol}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {instrumentKey}
                            </TableCell>
                            <TableCell className="text-right">
                              {h.quantity}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                h.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {inr.format(h.pnl)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">No holdings found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}

/**
 * Flatten a nested Upstox funds section into a single-level
 * Record<string, number> for clean display. Skips non-numeric leaves
 * and prefixes nested keys for readability.
 */
function flattenFundsSection(
  section: unknown,
  prefix = '',
): Record<string, number> {
  const result: Record<string, number> = {}
  if (!section || typeof section !== 'object') return result
  for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
    const label = prefix ? `${prefix} — ${humanize(k)}` : humanize(k)
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[label] = v
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenFundsSection(v, humanize(k)))
    }
  }
  return result
}
