// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VaultHealthCard } from './VaultHealthCard'
import { HealthNudge } from './HealthNudge'
import type { VaultHealth } from './useSecondBrain'
import { FRESH_HEALTH } from '../testSupport/hiveSecondBrainMock'

function health(overrides: Partial<VaultHealth> = {}): VaultHealth {
  return { ...FRESH_HEALTH, ...overrides }
}

function renderCard(overrides: Partial<VaultHealth> | null): {
  onLint: ReturnType<typeof vi.fn>
  onSnooze: ReturnType<typeof vi.fn>
} {
  const onLint = vi.fn()
  const onSnooze = vi.fn()
  render(
    createElement(VaultHealthCard, {
      health: overrides === null ? null : health(overrides),
      onLint,
      onSnooze
    })
  )
  return { onLint, onSnooze }
}

/** Segments actually painted as filled — the meter's visual truth. */
function filledSegments(): number {
  return document.querySelectorAll('.wb-brain-health-seg[data-filled]').length
}

describe('VaultHealthCard (SB-R10.1)', () => {
  afterEach(() => cleanup())

  it('renders nothing before the cadence has been fetched', () => {
    renderCard(null)
    expect(screen.queryByLabelText('Saúde da base')).toBeNull()
  })

  it('reads as status while the base is healthy: meter, count, and what is next', () => {
    renderCard({
      ingestsSinceLint: 4,
      lastLintAt: '2026-07-14T00:00:00.000Z',
      daysSinceLint: 12,
      daysUntilInterval: 18
    })

    expect(screen.getByText('Saúde da base')).toBeTruthy()
    expect(screen.getByText('4 de 10 ingestões')).toBeTruthy()
    expect(screen.getByText('Revisada há 12 dias')).toBeTruthy()
    expect(screen.getByText('Próxima revisão em 6 ingestões ou 18 dias')).toBeTruthy()
    expect(filledSegments()).toBe(4)
  })

  it('says so plainly when the base has never been health-checked', () => {
    renderCard({ ingestsSinceLint: 2, daysUntilInterval: 25 })
    expect(screen.getByText('Nunca revisada')).toBeTruthy()
  })

  it('never overfills the meter, however far past the threshold the count runs', () => {
    renderCard({ ingestsSinceLint: 25, reason: 'ingests', due: true })
    expect(filledSegments()).toBe(10)
  })

  it('turns into the ask when due: the reason leads and both answers are offered (SB-R10.4)', () => {
    const { onLint, onSnooze } = renderCard({ ingestsSinceLint: 10, reason: 'ingests', due: true })

    expect(screen.getByText('Hora do health-check')).toBeTruthy()
    expect(screen.getByText('10 ingestões desde a última revisão')).toBeTruthy()

    fireEvent.click(screen.getByText('Revisar agora'))
    expect(onLint).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Depois'))
    expect(onSnooze).toHaveBeenCalledTimes(1)
  })

  it('explains the calendar rule when that is what tripped', () => {
    renderCard({
      ingestsSinceLint: 3,
      lastLintAt: '2026-06-10T00:00:00.000Z',
      daysSinceLint: 46,
      daysUntilInterval: 0,
      reason: 'time',
      due: true
    })
    expect(screen.getByText('A última revisão foi há 46 dias')).toBeTruthy()
  })

  it('a snooze quiets the reminder but keeps the truth — and the CTA — in the panel (SB-R10.5)', () => {
    const { onLint } = renderCard({
      ingestsSinceLint: 11,
      reason: 'ingests',
      due: false,
      snoozedUntil: '2026-08-02T00:00:00.000Z'
    })

    expect(screen.getByText('Lembrete adiado — a base segue precisando de revisão')).toBeTruthy()
    // No second "Depois" while already snoozed; "Revisar agora" never leaves.
    expect(screen.queryByText('Depois')).toBeNull()
    fireEvent.click(screen.getByText('Revisar agora'))
    expect(onLint).toHaveBeenCalledTimes(1)
  })
})

describe('HealthNudge (SB-R10.4)', () => {
  afterEach(() => cleanup())

  it('announces the reason politely and offers both answers', () => {
    const onLint = vi.fn()
    const onSnooze = vi.fn()
    render(
      createElement(HealthNudge, {
        health: health({ ingestsSinceLint: 10, reason: 'ingests', due: true }),
        onLint,
        onSnooze
      })
    )

    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-label')).toBe('Hora do health-check')
    expect(screen.getByText('10 ingestões desde a última revisão')).toBeTruthy()

    fireEvent.click(screen.getByText('Revisar agora'))
    expect(onLint).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Depois'))
    expect(onSnooze).toHaveBeenCalledTimes(1)
  })
})
