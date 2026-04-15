export interface FoContractConfig {
  underlying: string
  instrumentType: 'FUT' | 'CE' | 'PE'
  expiryPolicy: 'current_month' | 'next_month' | 'current_week' | 'next_week'
  strikeSelection?: 'atm' | 'otm_1' | 'otm_2' | 'itm_1' | 'itm_2'
  lotMultiplier: number
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const VALID_INSTRUMENT_TYPES = ['FUT', 'CE', 'PE'] as const
const VALID_EXPIRY_POLICIES = ['current_month', 'next_month', 'current_week', 'next_week'] as const
const VALID_STRIKE_SELECTIONS = ['atm', 'otm_1', 'otm_2', 'itm_1', 'itm_2'] as const

export function validateFoContractConfig(
  input: unknown,
  prefix = '',
): ValidationResult<FoContractConfig> {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [`${prefix}F&O config must be an object`] }
  }

  const raw = input as Record<string, unknown>

  if (typeof raw.underlying !== 'string' || raw.underlying.trim() === '') {
    errors.push(`${prefix}underlying must be a non-empty string`)
  }

  if (!VALID_INSTRUMENT_TYPES.includes(raw.instrumentType as FoContractConfig['instrumentType'])) {
    errors.push(`${prefix}instrumentType must be one of FUT, CE, PE`)
  }

  if (!VALID_EXPIRY_POLICIES.includes(raw.expiryPolicy as FoContractConfig['expiryPolicy'])) {
    errors.push(
      `${prefix}expiryPolicy must be one of current_month, next_month, current_week, next_week`,
    )
  }

  if (
    typeof raw.lotMultiplier !== 'number' ||
    !Number.isInteger(raw.lotMultiplier) ||
    raw.lotMultiplier < 1
  ) {
    errors.push(`${prefix}lotMultiplier must be an integer greater than or equal to 1`)
  }

  if (raw.instrumentType === 'CE' || raw.instrumentType === 'PE') {
    if (raw.strikeSelection === undefined) {
      errors.push(`${prefix}strikeSelection is required when instrumentType is CE or PE`)
    }
  }

  if (
    raw.strikeSelection !== undefined &&
    !VALID_STRIKE_SELECTIONS.includes(raw.strikeSelection as NonNullable<FoContractConfig['strikeSelection']>)
  ) {
    errors.push(`${prefix}strikeSelection must be one of atm, otm_1, otm_2, itm_1, itm_2`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      underlying: raw.underlying as string,
      instrumentType: raw.instrumentType as FoContractConfig['instrumentType'],
      expiryPolicy: raw.expiryPolicy as FoContractConfig['expiryPolicy'],
      strikeSelection: raw.strikeSelection as FoContractConfig['strikeSelection'],
      lotMultiplier: raw.lotMultiplier as number,
    },
  }
}
