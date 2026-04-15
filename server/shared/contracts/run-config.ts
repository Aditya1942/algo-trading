import { validateFoContractConfig, type FoContractConfig } from './fo-contract.ts'
import { DEFAULT_RISK_LIMITS, validateRiskLimits, type RiskLimits } from './risk-limits.ts'

export interface StrategyRunConfig {
  mode: 'backtest' | 'paper' | 'live'
  strategyName: string
  instrumentKey: string
  interval: '1d' | '1h' | '1m'
  from?: string
  to?: string
  initialBalance: number
  params: Record<string, number>
  risk: RiskLimits
  fo?: FoContractConfig
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const VALID_MODES = ['backtest', 'paper', 'live'] as const
const VALID_INTERVALS = ['1d', '1h', '1m'] as const

function cloneDefaultRiskLimits(): RiskLimits {
  return { ...DEFAULT_RISK_LIMITS }
}

function isNumericRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

function validateOptionalString(
  value: unknown,
  key: 'from' | 'to',
  errors: string[],
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${key} must be a non-empty string when provided`)
    return undefined
  }

  return value
}

export function validateRunConfig(input: unknown): ValidationResult<StrategyRunConfig> {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['run config must be an object'] }
  }

  const raw = input as Record<string, unknown>
  const mode = raw.mode ?? 'backtest'

  if (!VALID_MODES.includes(mode as StrategyRunConfig['mode'])) {
    errors.push('mode must be one of backtest, paper, live')
  }

  if (typeof raw.strategyName !== 'string' || raw.strategyName.trim() === '') {
    errors.push('strategyName must be a non-empty string')
  }

  if (typeof raw.instrumentKey !== 'string' || raw.instrumentKey.trim() === '') {
    errors.push('instrumentKey must be a non-empty string')
  }

  const from = validateOptionalString(raw.from, 'from', errors)
  const to = validateOptionalString(raw.to, 'to', errors)

  if (!VALID_INTERVALS.includes(raw.interval as StrategyRunConfig['interval'])) {
    errors.push('interval must be one of 1d, 1h, 1m')
  }

  if (typeof raw.initialBalance !== 'number' || !Number.isFinite(raw.initialBalance) || raw.initialBalance <= 0) {
    errors.push('initialBalance must be a finite number greater than 0')
  }

  if (!isNumericRecord(raw.params)) {
    errors.push('params must be an object with numeric values')
  }

  if ((mode === 'backtest' || raw.mode === undefined) && from === undefined) {
    errors.push('from is required for backtest mode')
  }

  if ((mode === 'backtest' || raw.mode === undefined) && to === undefined) {
    errors.push('to is required for backtest mode')
  }

  let risk = cloneDefaultRiskLimits()
  if (raw.risk !== undefined) {
    const riskResult = validateRiskLimits(raw.risk, 'risk.')
    if (!riskResult.ok) {
      errors.push(...riskResult.errors)
    } else {
      risk = riskResult.value
    }
  }

  let fo: FoContractConfig | undefined
  if (raw.fo !== undefined) {
    const foResult = validateFoContractConfig(raw.fo, 'fo.')
    if (!foResult.ok) {
      errors.push(...foResult.errors)
    } else {
      fo = foResult.value
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      mode: mode as StrategyRunConfig['mode'],
      strategyName: raw.strategyName as string,
      instrumentKey: raw.instrumentKey as string,
      interval: raw.interval as StrategyRunConfig['interval'],
      from,
      to,
      initialBalance: raw.initialBalance as number,
      params: raw.params as Record<string, number>,
      risk,
      fo,
    },
  }
}
