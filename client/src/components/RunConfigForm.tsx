import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, FlaskConical, Shield, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useRunBacktestMutation, useStrategiesQuery } from '@/lib/backtest-queries'
import { useTrackedInstrumentsQuery } from '@/lib/market-data-queries'
import {
  DEFAULT_RISK_LIMITS,
  type BacktestConfig,
  type BacktestResult,
  type FoContractConfig,
  type RiskLimits,
  type StrategyInfo,
  type StrategyParamSpec,
} from '@/lib/api'

const TODAY = new Date().toISOString().slice(0, 10)
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function isFoEligibleInstrument(instrumentKey: string): boolean {
  return instrumentKey.includes('_FO|')
}

function groupParamSpecs(specs: StrategyParamSpec[]): Array<{
  key: string
  label?: string
  specs: StrategyParamSpec[]
}> {
  const groups = new Map<string, StrategyParamSpec[]>()

  for (const spec of specs) {
    const groupKey = spec.group ?? '__ungrouped__'
    const existing = groups.get(groupKey) ?? []
    existing.push(spec)
    groups.set(groupKey, existing)
  }

  return Array.from(groups, ([key, groupedSpecs]) => ({
    key,
    label: key === '__ungrouped__' ? undefined : key,
    specs: groupedSpecs,
  }))
}

function getStep(spec: StrategyParamSpec): string | number {
  if (spec.step !== undefined) {
    return spec.step
  }

  return spec.type === 'integer' ? 1 : 'any'
}

function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: StrategyParamSpec
  value: number
  onChange: (nextValue: number) => void
}) {
  if (spec.type === 'select' && spec.options) {
    return (
      <select
        id={`param-${spec.key}`}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {spec.options.map((option) => (
          <option key={`${spec.key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      id={`param-${spec.key}`}
      type="number"
      min={spec.min}
      max={spec.max}
      step={getStep(spec)}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function StrategyParamsSection({
  selectedStrategy,
  params,
  setParams,
}: {
  selectedStrategy?: StrategyInfo
  params: Record<string, number>
  setParams: Dispatch<SetStateAction<Record<string, number>>>
}) {
  if (!selectedStrategy) {
    return null
  }

  if (selectedStrategy.paramSpecs && selectedStrategy.paramSpecs.length > 0) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium">Strategy Parameters</label>
        <div className="space-y-4">
          {groupParamSpecs(selectedStrategy.paramSpecs).map((group) => (
            <div key={group.key} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              {group.label && (
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.specs.map((spec) => (
                  <div key={spec.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor={`param-${spec.key}`}>
                      {spec.label}
                    </label>
                    <ParamField
                      spec={spec}
                      value={params[spec.key] ?? spec.defaultValue}
                      onChange={(nextValue) =>
                        setParams((prev) => ({ ...prev, [spec.key]: nextValue }))
                      }
                    />
                    <div className="text-[11px] text-muted-foreground">
                      {spec.description ?? `${spec.key}${spec.min !== undefined || spec.max !== undefined ? ` (${spec.min ?? 'any'}-${spec.max ?? 'any'})` : ''}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (Object.keys(params).length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Strategy Parameters</label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(params).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={`param-${key}`}>
              {key}
            </label>
            <Input
              id={`param-${key}`}
              type="number"
              step="any"
              value={val}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionToggle({
  icon,
  label,
  open,
  onToggle,
}: {
  icon: ReactNode
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/35"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  )
}

export function RunConfigForm({ onResult }: { onResult: (result: BacktestResult) => void }) {
  const { data: strategies = [], isPending: strategiesLoading } = useStrategiesQuery()
  const { data: instruments = [], isPending: instrumentsLoading } = useTrackedInstrumentsQuery()
  const runMutation = useRunBacktestMutation()

  const [searchParams, setSearchParams] = useSearchParams()
  const preselectStrategy = searchParams.get('strategyName') ?? ''

  const [collapsed, setCollapsed] = useState(false)
  const [mode, setMode] = useState<'backtest' | 'paper' | 'live'>('backtest')
  const [strategyName, setStrategyName] = useState(preselectStrategy)

  useEffect(() => {
    if (!preselectStrategy || strategies.length === 0) return
    const match = strategies.find((s) => s.name === preselectStrategy)
    if (match) {
      setStrategyName(match.name)
      setParams({ ...match.defaultParams })
      if (match.supportedIntervals && !match.supportedIntervals.includes(interval)) {
        setIntervalVal(match.supportedIntervals[0]!)
      }
      if (match.supportedModes && !match.supportedModes.includes(mode)) {
        setMode(match.supportedModes[0]!)
      }
    }
    const next = new URLSearchParams(searchParams)
    next.delete('strategyName')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategies, preselectStrategy])
  const [instrumentKey, setInstrumentKey] = useState('')
  const [from, setFrom] = useState(ONE_YEAR_AGO)
  const [to, setTo] = useState(TODAY)
  const [interval, setIntervalVal] = useState<'1d' | '1h' | '1m'>('1d')
  const [initialBalance, setInitialBalance] = useState(100000)
  const [params, setParams] = useState<Record<string, number>>({})
  const [riskOpen, setRiskOpen] = useState(false)
  const [foOpen, setFoOpen] = useState(false)
  const [risk, setRisk] = useState<RiskLimits>({ ...DEFAULT_RISK_LIMITS })
  const [foConfig, setFoConfig] = useState<FoContractConfig>({
    underlying: '',
    instrumentType: 'FUT',
    expiryPolicy: 'current_month',
    lotMultiplier: 1,
  })
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const effectiveStrategyName = strategyName || strategies[0]?.name || ''
  const effectiveInstrumentKey = instrumentKey || instruments[0]?.instrument_key || ''

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.name === effectiveStrategyName),
    [effectiveStrategyName, strategies],
  )

  const selectedInstrument = useMemo(
    () => instruments.find((instrument) => instrument.instrument_key === effectiveInstrumentKey),
    [effectiveInstrumentKey, instruments],
  )

  const effectiveMode =
    selectedStrategy?.supportedModes && !selectedStrategy.supportedModes.includes(mode)
      ? selectedStrategy.supportedModes[0]!
      : mode
  const effectiveInterval =
    selectedStrategy?.supportedIntervals && !selectedStrategy.supportedIntervals.includes(interval)
      ? selectedStrategy.supportedIntervals[0]!
      : interval
  const effectiveParams =
    selectedStrategy && strategyName !== effectiveStrategyName
      ? { ...selectedStrategy.defaultParams }
      : params
  const foEligible = isFoEligibleInstrument(effectiveInstrumentKey)
  const effectiveFoOpen = foEligible ? foOpen : false
  const effectiveFoConfig: FoContractConfig = foEligible
    ? {
        ...foConfig,
        underlying: foConfig.underlying || selectedInstrument?.name || effectiveInstrumentKey,
      }
    : foConfig

  function updateRisk<K extends keyof RiskLimits>(key: K, value: RiskLimits[K]) {
    setRisk((prev) => ({ ...prev, [key]: value }))
  }

  function updateFo<K extends keyof FoContractConfig>(key: K, value: FoContractConfig[K]) {
    setFoConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage(null)

    if (!effectiveStrategyName || !effectiveInstrumentKey) {
      return
    }

    if (effectiveMode !== 'backtest') {
      setFormMessage(`${effectiveMode} mode is configured in the UI, but only backtest submission is wired to the API right now.`)
      return
    }

    const config: BacktestConfig = {
      mode: 'backtest',
      strategyName: effectiveStrategyName,
      instrumentKey: effectiveInstrumentKey,
      from,
      to,
      interval: effectiveInterval,
      initialBalance,
      params: effectiveParams,
      risk,
      ...(foEligible && effectiveFoOpen ? { fo: effectiveFoConfig } : {}),
    }

    runMutation.mutate(config, {
      onSuccess: (result) => {
        onResult(result)
        setCollapsed(true)
      },
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="h-4 w-4" />
            Configuration
          </CardTitle>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['backtest', 'paper', 'live'] as const).map((candidateMode) => {
                  const supported = !selectedStrategy?.supportedModes || selectedStrategy.supportedModes.includes(candidateMode)
                  return (
                    <button
                      key={candidateMode}
                      type="button"
                      disabled={!supported}
                      onClick={() => {
                        setMode(candidateMode)
                        setFormMessage(null)
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        candidateMode === effectiveMode
                          ? 'border-primary/70 bg-primary/10 text-foreground'
                          : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="text-sm font-medium capitalize">{candidateMode}</div>
                      <div className="text-xs text-muted-foreground">
                        {candidateMode === 'backtest'
                          ? 'Historical simulation'
                          : candidateMode === 'paper'
                            ? 'Dry-run order flow'
                            : 'Broker-routed execution'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="strategy-select">
                  Strategy
                </label>
                {strategiesLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <select
                    id="strategy-select"
                    value={effectiveStrategyName}
                    onChange={(e) => {
                      const nextStrategyName = e.target.value
                      const nextStrategy = strategies.find((strategy) => strategy.name === nextStrategyName)
                      setStrategyName(nextStrategyName)
                      setParams(nextStrategy ? { ...nextStrategy.defaultParams } : {})
                      if (nextStrategy?.supportedIntervals && !nextStrategy.supportedIntervals.includes(effectiveInterval)) {
                        setIntervalVal(nextStrategy.supportedIntervals[0]!)
                      }
                      if (nextStrategy?.supportedModes && !nextStrategy.supportedModes.includes(effectiveMode)) {
                        setMode(nextStrategy.supportedModes[0]!)
                      }
                      setFormMessage(null)
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select strategy...
                    </option>
                    {strategies.map((strategy) => (
                      <option key={strategy.name} value={strategy.name}>
                        {strategy.kind === 'custom'
                          ? `${strategy.displayName ?? strategy.name} (custom)`
                          : strategy.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedStrategy?.description && (
                  <p className="text-xs text-muted-foreground">{selectedStrategy.description}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="instrument-select">
                  Instrument
                </label>
                {instrumentsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : instruments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tracked instruments. Add one in Market Data first.
                  </p>
                ) : (
                  <select
                    id="instrument-select"
                    value={effectiveInstrumentKey}
                    onChange={(e) => {
                      setInstrumentKey(e.target.value)
                      setFormMessage(null)
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select instrument...
                    </option>
                    {instruments.map((instrument) => (
                      <option key={instrument.instrument_key} value={instrument.instrument_key}>
                        {instrument.name || instrument.instrument_key} ({instrument.exchange})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {effectiveMode === 'backtest' && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="from-date">
                      From
                    </label>
                    <Input
                      id="from-date"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="to-date">
                      To
                    </label>
                    <Input
                      id="to-date"
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="initial-balance">
                      Initial Balance (₹)
                    </label>
                    <Input
                      id="initial-balance"
                      type="number"
                      min={1000}
                      step={1000}
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Interval</label>
                  <div className="flex flex-wrap gap-2">
                    {(['1d', '1h', '1m'] as const).map((candidateInterval) => {
                      const supported =
                        !selectedStrategy?.supportedIntervals ||
                        selectedStrategy.supportedIntervals.includes(candidateInterval)

                      return (
                        <button
                          key={candidateInterval}
                          type="button"
                          disabled={!supported}
                          onClick={() => setIntervalVal(candidateInterval)}
                          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                            candidateInterval === effectiveInterval
                              ? 'border-primary/60 bg-primary/10 text-foreground'
                              : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {candidateInterval === '1d'
                            ? 'Daily'
                            : candidateInterval === '1h'
                              ? 'Hourly'
                              : '1 Min'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <StrategyParamsSection
              selectedStrategy={selectedStrategy}
              params={effectiveParams}
              setParams={setParams}
            />

            <div className="space-y-3">
              <SectionToggle
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
                label="Risk Limits"
                open={riskOpen}
                onToggle={() => setRiskOpen((current) => !current)}
              />
              {riskOpen && (
                <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="risk-maxDailyLossPct">
                      Max Daily Loss %
                    </label>
                    <Input
                      id="risk-maxDailyLossPct"
                      type="number"
                      min={0}
                      step="0.1"
                      value={risk.maxDailyLossPct}
                      onChange={(e) => updateRisk('maxDailyLossPct', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="risk-maxOpenPositions">
                      Max Open Positions
                    </label>
                    <Input
                      id="risk-maxOpenPositions"
                      type="number"
                      min={1}
                      step={1}
                      value={risk.maxOpenPositions}
                      onChange={(e) => updateRisk('maxOpenPositions', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="risk-maxCapitalPerTradePct">
                      Capital Per Trade %
                    </label>
                    <Input
                      id="risk-maxCapitalPerTradePct"
                      type="number"
                      min={0}
                      step="0.1"
                      value={risk.maxCapitalPerTradePct}
                      onChange={(e) => updateRisk('maxCapitalPerTradePct', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="risk-maxStrategyDrawdownPct">
                      Strategy Drawdown %
                    </label>
                    <Input
                      id="risk-maxStrategyDrawdownPct"
                      type="number"
                      min={0}
                      step="0.1"
                      value={risk.maxStrategyDrawdownPct}
                      onChange={(e) => updateRisk('maxStrategyDrawdownPct', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="risk-maxOrdersPerMinute">
                      Orders Per Minute
                    </label>
                    <Input
                      id="risk-maxOrdersPerMinute"
                      type="number"
                      min={1}
                      step={1}
                      value={risk.maxOrdersPerMinute}
                      onChange={(e) => updateRisk('maxOrdersPerMinute', Number(e.target.value))}
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={risk.killSwitchEnabled}
                      onChange={(e) => updateRisk('killSwitchEnabled', e.target.checked)}
                    />
                    Kill switch enabled
                  </label>
                </div>
              )}
            </div>

            {foEligible && (
              <div className="space-y-3">
                <SectionToggle
                  icon={<Workflow className="h-4 w-4 text-muted-foreground" />}
                  label="F&O Contract"
                open={effectiveFoOpen}
                onToggle={() => setFoOpen((current) => !current)}
              />
                {effectiveFoOpen && (
                  <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium" htmlFor="fo-underlying">
                        Underlying
                      </label>
                      <Input
                        id="fo-underlying"
                        value={effectiveFoConfig.underlying}
                        onChange={(e) => updateFo('underlying', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" htmlFor="fo-lotMultiplier">
                        Lot Multiplier
                      </label>
                      <Input
                        id="fo-lotMultiplier"
                        type="number"
                        min={1}
                        step={1}
                        value={effectiveFoConfig.lotMultiplier}
                        onChange={(e) => updateFo('lotMultiplier', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" htmlFor="fo-instrumentType">
                        Instrument Type
                      </label>
                      <select
                        id="fo-instrumentType"
                        value={effectiveFoConfig.instrumentType}
                        onChange={(e) =>
                          updateFo('instrumentType', e.target.value as FoContractConfig['instrumentType'])
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="FUT">Futures</option>
                        <option value="CE">Call Option</option>
                        <option value="PE">Put Option</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" htmlFor="fo-expiryPolicy">
                        Expiry Policy
                      </label>
                      <select
                        id="fo-expiryPolicy"
                        value={effectiveFoConfig.expiryPolicy}
                        onChange={(e) =>
                          updateFo('expiryPolicy', e.target.value as FoContractConfig['expiryPolicy'])
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="current_month">Current Month</option>
                        <option value="next_month">Next Month</option>
                        <option value="current_week">Current Week</option>
                        <option value="next_week">Next Week</option>
                      </select>
                    </div>
                    {effectiveFoConfig.instrumentType !== 'FUT' && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-medium" htmlFor="fo-strikeSelection">
                          Strike Selection
                        </label>
                        <select
                          id="fo-strikeSelection"
                          value={effectiveFoConfig.strikeSelection ?? 'atm'}
                          onChange={(e) =>
                            updateFo('strikeSelection', e.target.value as NonNullable<FoContractConfig['strikeSelection']>)
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="atm">ATM</option>
                          <option value="otm_1">OTM +1</option>
                          <option value="otm_2">OTM +2</option>
                          <option value="itm_1">ITM +1</option>
                          <option value="itm_2">ITM +2</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(formMessage || runMutation.isError) && (
              <p className="text-sm text-destructive">
                {formMessage ?? (runMutation.error as Error)?.message ?? 'Backtest failed'}
              </p>
            )}

            <Button
              type="submit"
              disabled={runMutation.isPending || !effectiveStrategyName || !effectiveInstrumentKey || effectiveMode !== 'backtest'}
              className="w-full sm:w-auto"
            >
              {runMutation.isPending
                ? 'Running...'
                : effectiveMode === 'backtest'
                  ? 'Run Backtest'
                  : `Run ${effectiveMode}`}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
