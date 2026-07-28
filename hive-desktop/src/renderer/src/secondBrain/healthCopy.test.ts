import { describe, expect, it } from 'vitest'
import { healthDueReason, healthLastLintLabel, healthMeter, healthNextLabel } from './healthCopy'
import type { VaultHealth } from './useSecondBrain'
import { FRESH_HEALTH } from '../testSupport/hiveSecondBrainMock'

function health(overrides: Partial<VaultHealth> = {}): VaultHealth {
  return { ...FRESH_HEALTH, ...overrides }
}

describe('healthCopy (SB-R10.1)', () => {
  it('phrases how long ago the last health-check was, down to today and yesterday', () => {
    expect(healthLastLintLabel(health())).toBe('Nunca revisada')
    expect(healthLastLintLabel(health({ lastLintAt: 'x', daysSinceLint: 0 }))).toBe('Revisada hoje')
    expect(healthLastLintLabel(health({ lastLintAt: 'x', daysSinceLint: 1 }))).toBe(
      'Revisada ontem'
    )
    expect(healthLastLintLabel(health({ lastLintAt: 'x', daysSinceLint: 9 }))).toBe(
      'Revisada há 9 dias'
    )
  })

  it('phrases each due reason, including the never-checked case', () => {
    expect(healthDueReason(health({ ingestsSinceLint: 10, reason: 'ingests' }))).toBe(
      '10 ingestões desde a última revisão'
    )
    expect(healthDueReason(health({ ingestsSinceLint: 1, reason: 'ingests' }))).toBe(
      '1 ingestão desde a última revisão'
    )
    expect(healthDueReason(health({ reason: 'time', lastLintAt: 'x', daysSinceLint: 33 }))).toBe(
      'A última revisão foi há 33 dias'
    )
    expect(healthDueReason(health({ reason: 'time' }))).toBe('A base nunca passou por uma revisão')
  })

  it('says what is still missing before the next check — both axes when both are running', () => {
    expect(healthNextLabel(health({ ingestsSinceLint: 4, daysUntilInterval: 18 }))).toBe(
      'Próxima revisão em 6 ingestões ou 18 dias'
    )
    expect(healthNextLabel(health({ ingestsSinceLint: 9, daysUntilInterval: 1 }))).toBe(
      'Próxima revisão em 1 ingestão ou 1 dia'
    )
  })

  it('describes a never-fed base by the count alone (its calendar clock has not started)', () => {
    expect(healthNextLabel(health({ ingestsSinceLint: 0, daysUntilInterval: 0 }))).toBe(
      'Próxima revisão em 10 ingestões'
    )
  })

  it('has nothing to promise once the base is already due', () => {
    expect(healthNextLabel(health({ ingestsSinceLint: 10, reason: 'ingests' }))).toBeNull()
  })

  it('clamps the meter to its track in both directions', () => {
    expect(healthMeter(health({ ingestsSinceLint: 4 }))).toEqual({ filled: 4, total: 10 })
    expect(healthMeter(health({ ingestsSinceLint: 42 }))).toEqual({ filled: 10, total: 10 })
    expect(healthMeter(health({ ingestsSinceLint: -1 }))).toEqual({ filled: 0, total: 10 })
    expect(healthMeter(health({ ingestThreshold: 0 }))).toEqual({ filled: 0, total: 1 })
  })
})
