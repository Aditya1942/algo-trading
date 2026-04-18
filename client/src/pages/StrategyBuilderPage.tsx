import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  Plus,
  Save,
  Play,
  CheckCircle2,
  XCircle,
  Trash2,
  Maximize2,
  Minimize2,
  Settings,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  useCustomStrategiesQuery,
  useCreateCustomStrategyMutation,
  useUpdateCustomStrategyMutation,
  useDeleteCustomStrategyMutation,
  useValidateCustomStrategyMutation,
} from '@/lib/custom-strategy-queries'
import type { CustomStrategy, StrategyParamSpec } from '@/lib/api'

const STARTER_CODE = `// User strategy — runs in isolated Bun Worker.
// Available globals: Strategy, indicators, registerStrategy, log
//
// ctx fields (provided to onCandle):
//   candle: { open, high, low, close, volume, timestamp }
//   window / candles: array of recent candles (<=200)
//   position: current open position or null
//   params: numeric params from paramSpecs
//   balance, initialBalance: capital state
//   indicators: { sma, ema, rsi, macd, bollingerBands }
//   log: pushes a line to run output
//   state: mutable bag persisted across onCandle calls
//
// Signal shape: { action: 'BUY'|'SELL', quantity, price, reason }

class MyStrategy extends Strategy {
  onStart(params) {
    this.fast = params.fastPeriod
    this.slow = params.slowPeriod
  }
  onCandle(candle, ctx) {
    if (ctx.window.length < this.slow) return null
    const closes = ctx.window.map(c => c.close)
    const fast = ctx.indicators.sma(closes, this.fast).at(-1)
    const slow = ctx.indicators.sma(closes, this.slow).at(-1)
    if (fast > slow && !ctx.position) {
      return { action: 'BUY', quantity: 1, price: candle.close, reason: 'fast above slow' }
    }
    if (fast < slow && ctx.position) {
      return { action: 'SELL', quantity: 1, price: candle.close, reason: 'fast below slow' }
    }
    return null
  }
  onStop() {}
}
registerStrategy(MyStrategy)
`

const STARTER_PARAMS: StrategyParamSpec[] = [
  { key: 'fastPeriod', label: 'Fast Period', type: 'integer', required: true, defaultValue: 10, min: 2, max: 200 },
  { key: 'slowPeriod', label: 'Slow Period', type: 'integer', required: true, defaultValue: 30, min: 2, max: 400 },
]

interface Draft {
  id: number | null
  name: string
  description: string
  code: string
  paramSpecsText: string
}

function newDraft(): Draft {
  return {
    id: null,
    name: '',
    description: '',
    code: STARTER_CODE,
    paramSpecsText: JSON.stringify(STARTER_PARAMS, null, 2),
  }
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
  variant = 'ghost',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'ghost' | 'destructive' | 'default' | 'secondary'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant={variant} onClick={onClick} disabled={disabled}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

function draftFromRow(row: CustomStrategy): Draft {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    paramSpecsText: JSON.stringify(row.paramSpecs, null, 2),
  }
}

export function StrategyBuilderPage() {
  const navigate = useNavigate()
  const listQuery = useCustomStrategiesQuery()
  const createMut = useCreateCustomStrategyMutation()
  const updateMut = useUpdateCustomStrategyMutation()
  const deleteMut = useDeleteCustomStrategyMutation()
  const validateMut = useValidateCustomStrategyMutation()

  const [draft, setDraft] = useState<Draft>(newDraft)
  const [validationMsg, setValidationMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)
  const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[0] | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    // Reset Monaco's cached dimensions, then remeasure after browser reflow.
    // Without the reset, stale dims from pre-toggle container persist and
    // editor renders off-screen after collapse.
    editor.layout({ width: 0, height: 0 })
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        editorRef.current?.layout()
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [expanded])

  const paramSpecsParsed = useMemo(() => {
    try {
      const value = JSON.parse(draft.paramSpecsText)
      if (!Array.isArray(value)) return { ok: false as const, error: 'must be an array' }
      return { ok: true as const, value: value as StrategyParamSpec[] }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }, [draft.paramSpecsText])

  const canSave = draft.name.trim() !== '' && draft.code.trim() !== '' && paramSpecsParsed.ok

  async function handleSave() {
    setSaveError(null)
    if (!paramSpecsParsed.ok) {
      setSaveError(`paramSpecs invalid: ${paramSpecsParsed.error}`)
      return
    }
    const payload = {
      name: draft.name,
      description: draft.description,
      code: draft.code,
      paramSpecs: paramSpecsParsed.value,
    }
    try {
      if (draft.id === null) {
        const row = await createMut.mutateAsync(payload)
        setDraft(draftFromRow(row))
      } else {
        const row = await updateMut.mutateAsync({ id: draft.id, patch: payload })
        setDraft(draftFromRow(row))
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleValidate() {
    if (draft.id === null) {
      setValidationMsg({ ok: false, text: 'Save first, then validate.' })
      return
    }
    try {
      const result = await validateMut.mutateAsync(draft.id)
      setValidationMsg({
        ok: result.ok,
        text: result.ok ? `OK. ${(result.logs ?? []).join(' | ') || 'no logs'}` : result.error || 'failed',
      })
    } catch (err) {
      setValidationMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleDelete() {
    if (draft.id === null) return
    if (!confirm(`Delete "${draft.name}"? This cannot be undone.`)) return
    await deleteMut.mutateAsync(draft.id)
    setDraft(newDraft())
  }

  function handleRunBacktest() {
    if (draft.id === null) return
    navigate(`/backtest?strategyName=custom:${draft.id}`)
  }

  const savePending = createMut.isPending || updateMut.isPending

  const editorBlock = (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded border">
      <div className="min-w-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={draft.code}
          onChange={(value) => setDraft({ ...draft, code: value ?? '' })}
          onMount={(editor) => {
            editorRef.current = editor
          }}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
      <div className="flex w-12 flex-col items-center gap-1 border-l bg-muted/30 p-1">
        <ToolbarButton
          label={expanded ? 'Collapse' : 'Expand'}
          icon={expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          onClick={() => setExpanded((v) => !v)}
        />
        <ToolbarButton
          label="Validate"
          icon={<CheckCircle2 className="size-4" />}
          onClick={handleValidate}
          disabled={validateMut.isPending || draft.id === null}
          variant="secondary"
        />
        <ToolbarButton
          label="Save"
          icon={<Save className="size-4" />}
          onClick={handleSave}
          disabled={!canSave || savePending}
          variant="default"
        />
        <ToolbarButton
          label="Run Backtest"
          icon={<Play className="size-4" />}
          onClick={handleRunBacktest}
          disabled={draft.id === null}
          variant="default"
        />
        <ToolbarButton
          label="Delete"
          icon={<Trash2 className="size-4" />}
          onClick={handleDelete}
          disabled={draft.id === null}
          variant="destructive"
        />
        <ToolbarButton
          label="Params (paramSpecs)"
          icon={<Settings className="size-4" />}
          onClick={() => setParamsOpen(true)}
        />
      </div>
    </div>
  )

  const paramsSheet = (
    <Sheet open={paramsOpen} onOpenChange={setParamsOpen}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>paramSpecs</SheetTitle>
          <SheetDescription>
            JSON array describing runtime parameters surfaced to the strategy.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">JSON</label>
            {paramSpecsParsed.ok ? (
              <Badge variant="secondary" className="text-xs">
                {paramSpecsParsed.value.length} param(s)
              </Badge>
            ) : (
              <span className="text-xs text-destructive">Invalid: {paramSpecsParsed.error}</span>
            )}
          </div>
          <textarea
            className="h-[60vh] w-full resize-y rounded border bg-muted/40 p-2 font-mono text-xs"
            value={draft.paramSpecsText}
            onChange={(e) => setDraft({ ...draft, paramSpecsText: e.target.value })}
          />
        </div>
      </SheetContent>
    </Sheet>
  )

  if (expanded) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {editorBlock}
        </div>
        {paramsSheet}
      </>
    )
  }

  return (
    <AppShell title="Strategy Builder">
      <div
        className="grid min-h-0 flex-1 gap-4 grid-cols-[260px_1fr]"
      >
        {!expanded && (
          <Card className="flex min-h-0 flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm">My Strategies</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setDraft(newDraft())}>
                <Plus className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-2">
              {listQuery.isLoading ? (
                <Skeleton className="h-24" />
              ) : listQuery.data && listQuery.data.length > 0 ? (
                <ul className="space-y-1">
                  {listQuery.data.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                          draft.id === row.id ? 'bg-muted font-medium' : ''
                        }`}
                        onClick={() => setDraft(draftFromRow(row))}
                      >
                        <span className="truncate">{row.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">#{row.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 text-xs text-muted-foreground">No custom strategies yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex min-h-0 flex-col gap-3">
          {!expanded && (
            <Card>
              <CardContent className="grid gap-3 p-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="my-strategy"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What this strategy does"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="p-3">
              <CardTitle className="text-sm">Code</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-0">
              {saveError && (
                <div className="rounded border border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {saveError}
                </div>
              )}
              {validationMsg && (
                <div
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                    validationMsg.ok
                      ? 'border-green-600/40 bg-green-600/10 text-green-600'
                      : 'border-destructive bg-destructive/10 text-destructive'
                  }`}
                >
                  {validationMsg.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  <span className="truncate">{validationMsg.text}</span>
                </div>
              )}
              {editorBlock}
            </CardContent>
          </Card>
        </div>
      </div>
      {paramsSheet}
    </AppShell>
  )
}
