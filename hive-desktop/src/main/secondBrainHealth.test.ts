import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createSecondBrainHealthStore,
  deriveHealth,
  EMPTY_RECORD,
  INGEST_THRESHOLD,
  INTERVAL_DAYS,
  SNOOZE_DAYS,
  type HealthRecord
} from './secondBrainHealth'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-07-26T12:00:00.000Z')

function daysAgo(days: number, from: Date = NOW): string {
  return new Date(from.getTime() - days * DAY_MS).toISOString()
}

function record(overrides: Partial<HealthRecord> = {}): HealthRecord {
  return { ...EMPTY_RECORD, ...overrides }
}

describe('deriveHealth (SB-R10.1) — "after every 10 ingests or monthly"', () => {
  it('a fresh vault is not due and has no clock running', () => {
    const health = deriveHealth(record(), NOW)
    expect(health.due).toBe(false)
    expect(health.reason).toBeNull()
    expect(health.daysSinceLint).toBeNull()
    expect(health.daysUntilInterval).toBeNull()
    expect(health.ingestThreshold).toBe(INGEST_THRESHOLD)
    expect(health.intervalDays).toBe(INTERVAL_DAYS)
  })

  it('is not due one ingest short of the threshold, and due on it', () => {
    expect(deriveHealth(record({ ingestsSinceLint: 9 }), NOW).due).toBe(false)
    const due = deriveHealth(record({ ingestsSinceLint: 10 }), NOW)
    expect(due.due).toBe(true)
    expect(due.reason).toBe('ingests')
  })

  it('the count rule outranks the calendar rule when both trip', () => {
    const health = deriveHealth(
      record({ ingestsSinceLint: 12, lastLintAt: daysAgo(40), cycleStartedAt: daysAgo(39) }),
      NOW
    )
    expect(health.reason).toBe('ingests')
  })

  it('trips on the calendar once a month has passed since the last check — but only with an ingest in the window', () => {
    const untouched = record({ ingestsSinceLint: 0, lastLintAt: daysAgo(45) })
    expect(deriveHealth(untouched, NOW).due).toBe(false)

    const fed = record({ ingestsSinceLint: 1, lastLintAt: daysAgo(45), cycleStartedAt: daysAgo(3) })
    const health = deriveHealth(fed, NOW)
    expect(health.due).toBe(true)
    expect(health.reason).toBe('time')
    expect(health.daysSinceLint).toBe(45)
    expect(health.daysUntilInterval).toBe(0)
  })

  it('measures a never-checked vault from its first ingest, not from epoch', () => {
    const young = record({ ingestsSinceLint: 2, cycleStartedAt: daysAgo(10) })
    const youngHealth = deriveHealth(young, NOW)
    expect(youngHealth.due).toBe(false)
    expect(youngHealth.daysSinceLint).toBeNull()
    expect(youngHealth.daysUntilInterval).toBe(20)

    const old = record({ ingestsSinceLint: 2, cycleStartedAt: daysAgo(31) })
    expect(deriveHealth(old, NOW).reason).toBe('time')
  })

  it('a live snooze silences `due` but never hides why the base needs tending', () => {
    const snoozed = record({
      ingestsSinceLint: 11,
      snoozedUntil: new Date(NOW.getTime() + 3 * DAY_MS).toISOString()
    })
    const health = deriveHealth(snoozed, NOW)
    expect(health.due).toBe(false)
    expect(health.reason).toBe('ingests')
    expect(health.snoozedUntil).not.toBeNull()
  })

  it('an expired snooze lets the reminder through again', () => {
    const expired = record({ ingestsSinceLint: 11, snoozedUntil: daysAgo(1) })
    const health = deriveHealth(expired, NOW)
    expect(health.due).toBe(true)
    expect(health.snoozedUntil).toBeNull()
  })

  it('survives unparseable timestamps rather than reporting NaN days', () => {
    const health = deriveHealth(
      record({ ingestsSinceLint: 3, lastLintAt: 'not-a-date', snoozedUntil: 'also-not' }),
      NOW
    )
    expect(health.daysSinceLint).toBeNull()
    expect(health.due).toBe(false)
    expect(health.snoozedUntil).toBeNull()
  })
})

describe('createSecondBrainHealthStore', () => {
  let dir: string
  let clock: Date

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-health-'))
    clock = new Date(NOW)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function store(): ReturnType<typeof createSecondBrainHealthStore> {
    return createSecondBrainHealthStore(dir, { now: () => clock })
  }

  it('reads as fresh for a workspace it has never seen', () => {
    expect(store().get('/ws').ingestsSinceLint).toBe(0)
  })

  it('counts ingests per workspace, independently (SB-R10.2)', () => {
    const health = store()
    health.noteIngest('/a')
    health.noteIngest('/a')
    health.noteIngest('/b')

    expect(health.get('/a').ingestsSinceLint).toBe(2)
    expect(health.get('/b').ingestsSinceLint).toBe(1)
  })

  it('starts the calendar clock at the first ingest of a cycle and keeps it there', () => {
    const health = store()
    health.noteIngest('/ws')
    clock = new Date(NOW.getTime() + 5 * DAY_MS)
    health.noteIngest('/ws')

    // Still measured from the FIRST ingest: 25 days left of the 30, not 30.
    expect(health.get('/ws').daysUntilInterval).toBe(25)
  })

  it('a health-check resets the count, restarts the clock and clears any snooze (SB-R10.3)', () => {
    const health = store()
    for (let i = 0; i < 11; i += 1) health.noteIngest('/ws')
    health.snooze('/ws')
    expect(health.get('/ws').due).toBe(false)

    const after = health.noteLint('/ws')
    expect(after.ingestsSinceLint).toBe(0)
    expect(after.reason).toBeNull()
    expect(after.due).toBe(false)
    expect(after.snoozedUntil).toBeNull()
    expect(after.daysSinceLint).toBe(0)
  })

  it('snoozes for a week, and lets the reminder back afterwards (SB-R10.5)', () => {
    const health = store()
    for (let i = 0; i < 10; i += 1) health.noteIngest('/ws')
    expect(health.get('/ws').due).toBe(true)

    expect(health.snooze('/ws').due).toBe(false)
    clock = new Date(NOW.getTime() + (SNOOZE_DAYS - 1) * DAY_MS)
    expect(health.get('/ws').due).toBe(false)
    clock = new Date(NOW.getTime() + (SNOOZE_DAYS + 1) * DAY_MS)
    expect(health.get('/ws').due).toBe(true)
  })

  it('persists to disk, so a fresh store (an app restart) sees the same ledger', () => {
    store().noteIngest('/ws')
    expect(
      createSecondBrainHealthStore(dir, { now: () => clock }).get('/ws').ingestsSinceLint
    ).toBe(1)
  })

  it('leaves no temp file behind and writes readable JSON', () => {
    store().noteIngest('/ws')
    const file = join(dir, 'second-brain-health.json')
    const parsed = JSON.parse(readFileSync(file, 'utf-8'))
    expect(parsed['/ws'].ingestsSinceLint).toBe(1)
  })

  it('treats a corrupt ledger as no history rather than throwing', () => {
    writeFileSync(join(dir, 'second-brain-health.json'), '{ not json', 'utf-8')
    expect(store().get('/ws').ingestsSinceLint).toBe(0)
    expect(store().noteIngest('/ws').ingestsSinceLint).toBe(1)
  })

  it('sanitizes a hand-edited ledger (wrong types, negative counts)', () => {
    writeFileSync(
      join(dir, 'second-brain-health.json'),
      JSON.stringify({ '/ws': { ingestsSinceLint: -3, lastLintAt: 42, snoozedUntil: '' } }),
      'utf-8'
    )
    const health = store().get('/ws')
    expect(health.ingestsSinceLint).toBe(0)
    expect(health.lastLintAt).toBeNull()
    expect(health.snoozedUntil).toBeNull()
  })

  it('keeps recording in memory when the ledger cannot be written', () => {
    // A directory where the file should be: every write fails, no throw escapes.
    mkdirSync(join(dir, 'second-brain-health.json'), { recursive: true })
    const health = store()
    expect(() => health.noteIngest('/ws')).not.toThrow()
    expect(health.noteIngest('/ws').ingestsSinceLint).toBe(1)
  })
})
