import { describe, expect, test } from 'bun:test'
import { DEFAULT_RISK_LIMITS } from '../../../shared/contracts/index.ts'
import { applyRiskStateUpdate, checkRuntimeRisk, createInitialRiskState } from '../runtime.ts'

describe('risk runtime helpers', () => {
  test('createInitialRiskState seeds capital and peak capital', () => {
    const state = createInitialRiskState(250000)

    expect(state.initialCapital).toBe(250000)
    expect(state.currentCapital).toBe(250000)
    expect(state.peakCapital).toBe(250000)
    expect(state.ordersThisMinute).toBe(0)
  })

  test('applyRiskStateUpdate updates capital, peak capital, and counters', () => {
    const state = createInitialRiskState(100000)
    const updated = applyRiskStateUpdate(state, {
      dailyPnlDelta: 1500,
      currentCapital: 102000,
      openPositionCountDelta: 1,
      ordersThisMinuteDelta: 2,
    })

    expect(updated.dailyPnl).toBe(1500)
    expect(updated.currentCapital).toBe(102000)
    expect(updated.peakCapital).toBe(102000)
    expect(updated.openPositionCount).toBe(1)
    expect(updated.ordersThisMinute).toBe(2)
  })

  test('applyRiskStateUpdate can reset the order counter and trip kill switch', () => {
    const state = applyRiskStateUpdate(createInitialRiskState(100000), {
      ordersThisMinuteDelta: 4,
    })
    const updated = applyRiskStateUpdate(state, {
      resetOrdersThisMinute: true,
      tripKillSwitch: true,
    })

    expect(updated.ordersThisMinute).toBe(0)
    expect(updated.killSwitchTripped).toBe(true)
  })

  test('checkRuntimeRisk returns drawdown rejection when state has breached limits', () => {
    const result = checkRuntimeRisk(DEFAULT_RISK_LIMITS, {
      ...createInitialRiskState(100000),
      currentCapital: 83000,
      peakCapital: 100000,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('DRAWDOWN_EXCEEDED')
  })

  test('checkRuntimeRisk returns kill switch rejection when runtime state is tripped', () => {
    const result = checkRuntimeRisk(DEFAULT_RISK_LIMITS, {
      ...createInitialRiskState(100000),
      killSwitchTripped: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.rejectCode).toBe('KILL_SWITCH_ACTIVE')
  })
})
