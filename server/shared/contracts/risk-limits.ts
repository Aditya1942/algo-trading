export interface RiskLimits {
  maxDailyLossPct: number
  maxOpenPositions: number
  maxCapitalPerTradePct: number
  maxStrategyDrawdownPct: number
  maxOrdersPerMinute: number
  killSwitchEnabled: boolean
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLossPct: 3,
  maxOpenPositions: 5,
  maxCapitalPerTradePct: 20,
  maxStrategyDrawdownPct: 15,
  maxOrdersPerMinute: 10,
  killSwitchEnabled: true,
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

function pushRangeError(
  errors: string[],
  key: keyof RiskLimits,
  value: unknown,
  prefix: string,
): void {
  const name = `${prefix}${key}`
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${name} must be between 0 and 100`)
    return
  }

  if (value < 0 || value > 100) {
    errors.push(`${name} must be between 0 and 100`)
  }
}

function pushMinIntegerError(
  errors: string[],
  key: keyof RiskLimits,
  value: unknown,
  minimum: number,
  prefix: string,
): void {
  const name = `${prefix}${key}`
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    errors.push(`${name} must be an integer greater than or equal to ${minimum}`)
  }
}

export function validateRiskLimits(input: unknown, prefix = ''): ValidationResult<RiskLimits> {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [`${prefix}risk limits must be an object`] }
  }

  const raw = input as Record<string, unknown>

  pushRangeError(errors, 'maxDailyLossPct', raw.maxDailyLossPct, prefix)
  pushMinIntegerError(errors, 'maxOpenPositions', raw.maxOpenPositions, 1, prefix)
  pushRangeError(errors, 'maxCapitalPerTradePct', raw.maxCapitalPerTradePct, prefix)
  pushRangeError(errors, 'maxStrategyDrawdownPct', raw.maxStrategyDrawdownPct, prefix)
  pushMinIntegerError(errors, 'maxOrdersPerMinute', raw.maxOrdersPerMinute, 1, prefix)

  if (typeof raw.killSwitchEnabled !== 'boolean') {
    errors.push(`${prefix}killSwitchEnabled must be a boolean`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      maxDailyLossPct: raw.maxDailyLossPct as number,
      maxOpenPositions: raw.maxOpenPositions as number,
      maxCapitalPerTradePct: raw.maxCapitalPerTradePct as number,
      maxStrategyDrawdownPct: raw.maxStrategyDrawdownPct as number,
      maxOrdersPerMinute: raw.maxOrdersPerMinute as number,
      killSwitchEnabled: raw.killSwitchEnabled as boolean,
    },
  }
}
