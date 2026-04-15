import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_RISK_LIMITS,
  validateFoContractConfig,
  validateRiskLimits,
  validateRunConfig,
  validateStrategyParamSpec,
} from '../index.ts'

describe('contracts validation', () => {
  test('validateStrategyParamSpec accepts a valid integer spec', () => {
    const result = validateStrategyParamSpec({
      key: 'fastPeriod',
      label: 'Fast Period',
      type: 'integer',
      required: true,
      defaultValue: 10,
      min: 2,
      max: 200,
      step: 1,
      group: 'SMA',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.key).toBe('fastPeriod')
      expect(result.value.defaultValue).toBe(10)
    }
  })

  test('validateStrategyParamSpec rejects invalid select spec', () => {
    const result = validateStrategyParamSpec({
      key: '',
      label: 'Expiry',
      type: 'select',
      required: true,
      defaultValue: 3,
      options: [{ label: '', value: 'bad' }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('key must be a non-empty string')
      expect(result.errors).toContain('defaultValue must match one of the select option values')
      expect(result.errors).toContain('options[0].label must be a non-empty string')
      expect(result.errors).toContain('options[0].value must be a finite number')
    }
  })

  test('validateRiskLimits accepts the default limits', () => {
    const result = validateRiskLimits(DEFAULT_RISK_LIMITS)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.maxDailyLossPct).toBe(3)
    }
  })

  test('validateRiskLimits rejects negative and non-boolean values', () => {
    const result = validateRiskLimits({
      maxDailyLossPct: -1,
      maxOpenPositions: 0,
      maxCapitalPerTradePct: 120,
      maxStrategyDrawdownPct: '15',
      maxOrdersPerMinute: NaN,
      killSwitchEnabled: 'yes',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('maxDailyLossPct must be between 0 and 100')
      expect(result.errors).toContain('maxOpenPositions must be an integer greater than or equal to 1')
      expect(result.errors).toContain('maxCapitalPerTradePct must be between 0 and 100')
      expect(result.errors).toContain('maxStrategyDrawdownPct must be between 0 and 100')
      expect(result.errors).toContain('maxOrdersPerMinute must be an integer greater than or equal to 1')
      expect(result.errors).toContain('killSwitchEnabled must be a boolean')
    }
  })

  test('validateFoContractConfig accepts a valid options config', () => {
    const result = validateFoContractConfig({
      underlying: 'NIFTY',
      instrumentType: 'CE',
      expiryPolicy: 'current_week',
      strikeSelection: 'atm',
      lotMultiplier: 2,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.instrumentType).toBe('CE')
    }
  })

  test('validateFoContractConfig rejects invalid instrument and missing strike policy for options', () => {
    const result = validateFoContractConfig({
      underlying: '',
      instrumentType: 'INVALID',
      expiryPolicy: 'tomorrow',
      lotMultiplier: 0,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('underlying must be a non-empty string')
      expect(result.errors).toContain('instrumentType must be one of FUT, CE, PE')
      expect(result.errors).toContain(
        'expiryPolicy must be one of current_month, next_month, current_week, next_week',
      )
      expect(result.errors).toContain('lotMultiplier must be an integer greater than or equal to 1')
    }
  })

  test('validateRunConfig normalizes the legacy backtest shape', () => {
    const result = validateRunConfig({
      strategyName: 'sma-crossover',
      instrumentKey: 'NSE_EQ|RELIANCE',
      from: '2024-01-01',
      to: '2024-01-31',
      interval: '1d',
      initialBalance: 100000,
      params: { fastPeriod: 10, slowPeriod: 50 },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.mode).toBe('backtest')
      expect(result.value.risk).toEqual(DEFAULT_RISK_LIMITS)
    }
  })

  test('validateRunConfig accepts explicit risk and F&O config', () => {
    const result = validateRunConfig({
      mode: 'backtest',
      strategyName: 'option-strategy',
      instrumentKey: 'NSE_FO|NIFTY',
      from: '2024-01-01',
      to: '2024-01-31',
      interval: '1m',
      initialBalance: 250000,
      params: { premiumDecay: 5 },
      risk: { ...DEFAULT_RISK_LIMITS, maxOpenPositions: 2 },
      fo: {
        underlying: 'NIFTY',
        instrumentType: 'CE',
        expiryPolicy: 'current_week',
        strikeSelection: 'otm_1',
        lotMultiplier: 1,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fo?.strikeSelection).toBe('otm_1')
      expect(result.value.risk.maxOpenPositions).toBe(2)
    }
  })

  test('validateRunConfig rejects invalid shape with actionable errors', () => {
    const result = validateRunConfig({
      mode: 'swing',
      strategyName: '',
      instrumentKey: '',
      from: 123,
      interval: '5m',
      initialBalance: 0,
      params: [],
      risk: { ...DEFAULT_RISK_LIMITS, maxOrdersPerMinute: 0 },
      fo: {
        underlying: 'BANKNIFTY',
        instrumentType: 'PE',
        expiryPolicy: 'current_week',
        lotMultiplier: 1,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('mode must be one of backtest, paper, live')
      expect(result.errors).toContain('strategyName must be a non-empty string')
      expect(result.errors).toContain('instrumentKey must be a non-empty string')
      expect(result.errors).toContain('from must be a non-empty string when provided')
      expect(result.errors).toContain('interval must be one of 1d, 1h, 1m')
      expect(result.errors).toContain('initialBalance must be a finite number greater than 0')
      expect(result.errors).toContain('params must be an object with numeric values')
      expect(result.errors).toContain('risk.maxOrdersPerMinute must be an integer greater than or equal to 1')
      expect(result.errors).toContain('fo.strikeSelection is required when instrumentType is CE or PE')
    }
  })
})
