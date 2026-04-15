export interface StrategyParamSpecOption {
  label: string
  value: number
}

export interface StrategyParamSpec {
  key: string
  label: string
  type: 'number' | 'integer' | 'select'
  required: boolean
  defaultValue: number
  min?: number
  max?: number
  step?: number
  options?: StrategyParamSpecOption[]
  description?: string
  group?: string
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateStrategyParamSpec(input: unknown): ValidationResult<StrategyParamSpec> {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['strategy param spec must be an object'] }
  }

  const raw = input as Record<string, unknown>
  const type = raw.type

  if (typeof raw.key !== 'string' || raw.key.trim() === '') {
    errors.push('key must be a non-empty string')
  }

  if (typeof raw.label !== 'string' || raw.label.trim() === '') {
    errors.push('label must be a non-empty string')
  }

  if (type !== 'number' && type !== 'integer' && type !== 'select') {
    errors.push('type must be one of number, integer, select')
  }

  if (typeof raw.required !== 'boolean') {
    errors.push('required must be a boolean')
  }

  if (!isFiniteNumber(raw.defaultValue)) {
    errors.push('defaultValue must be a finite number')
  } else if (type === 'integer' && !Number.isInteger(raw.defaultValue)) {
    errors.push('defaultValue must be an integer when type is integer')
  }

  for (const key of ['min', 'max', 'step', 'description', 'group'] as const) {
    const value = raw[key]
    if (value === undefined) continue

    if (key === 'description' || key === 'group') {
      if (typeof value !== 'string') {
        errors.push(`${key} must be a string when provided`)
      }
      continue
    }

    if (!isFiniteNumber(value)) {
      errors.push(`${key} must be a finite number when provided`)
    } else if ((key === 'min' || key === 'max' || key === 'step') && type === 'integer' && !Number.isInteger(value)) {
      errors.push(`${key} must be an integer when type is integer`)
    }
  }

  if (isFiniteNumber(raw.min) && isFiniteNumber(raw.max) && raw.min > raw.max) {
    errors.push('min must be less than or equal to max')
  }

  if (type === 'select') {
    if (!Array.isArray(raw.options) || raw.options.length === 0) {
      errors.push('options must be a non-empty array when type is select')
      if (isFiniteNumber(raw.defaultValue)) {
        errors.push('defaultValue must match one of the select option values')
      }
    } else {
      const optionValues: number[] = []
      raw.options.forEach((option, index) => {
        if (typeof option !== 'object' || option === null || Array.isArray(option)) {
          errors.push(`options[${index}] must be an object`)
          return
        }

        const value = option as Record<string, unknown>
        if (typeof value.label !== 'string' || value.label.trim() === '') {
          errors.push(`options[${index}].label must be a non-empty string`)
        }
        if (!isFiniteNumber(value.value)) {
          errors.push(`options[${index}].value must be a finite number`)
        } else {
          optionValues.push(value.value)
        }
      })

      if (isFiniteNumber(raw.defaultValue) && !optionValues.includes(raw.defaultValue)) {
        errors.push('defaultValue must match one of the select option values')
      }
    }
  } else if (raw.options !== undefined && !Array.isArray(raw.options)) {
    errors.push('options must be an array when provided')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const spec: StrategyParamSpec = {
    key: raw.key as string,
    label: raw.label as string,
    type: raw.type as StrategyParamSpec['type'],
    required: raw.required as boolean,
    defaultValue: raw.defaultValue as number,
  }

  if (raw.min !== undefined) spec.min = raw.min as number
  if (raw.max !== undefined) spec.max = raw.max as number
  if (raw.step !== undefined) spec.step = raw.step as number
  if (raw.options !== undefined) spec.options = raw.options as StrategyParamSpecOption[]
  if (raw.description !== undefined) spec.description = raw.description as string
  if (raw.group !== undefined) spec.group = raw.group as string

  return { ok: true, value: spec }
}
