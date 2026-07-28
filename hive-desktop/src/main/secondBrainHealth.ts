import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VaultHealth } from './secondBrainTypes'

/**
 * The `second-brain` skill documents one maintenance practice for
 * `/second-brain-lint`: **"run after every 10 ingests or monthly"**. Left to the
 * user that is a rule nobody remembers — so the app keeps the ledger and does
 * the remembering (SB-R10).
 *
 * Deliberately a *separate* store from `configStore.ts`: this is per-workspace
 * operational state that changes on every ingest, while `config.json` is the
 * user's global profile. Same durability contract though — atomic
 * write-then-rename, disk as the single source of truth, corrupt file treated
 * as "no history" rather than thrown.
 *
 * It lives in `userData`, NOT in the vault, on purpose: the vault is
 * git-versioned and shared with the squad (D-SB-2), and a counter that bumps on
 * every capture would produce a diff per ingest and a merge conflict per pull.
 * The cadence is a personal reminder, not squad content.
 */

/** What we persist per workspace. Everything else in `VaultHealth` is derived. */
export interface HealthRecord {
  /** Ingests launched from Hive since the last recorded health-check. */
  ingestsSinceLint: number
  /** ISO timestamp of the last recorded health-check, or null if never run. */
  lastLintAt: string | null
  /**
   * ISO timestamp of the first ingest of the current cycle — the calendar
   * clock's anchor when the base has never been health-checked (without it, a
   * brand-new vault would be "overdue" the day it is created).
   */
  cycleStartedAt: string | null
  /** ISO timestamp the user postponed the reminder until, or null. */
  snoozedUntil: string | null
}

/** The documented cadence: a health-check after every 10 ingests… */
export const INGEST_THRESHOLD = 10
/** …or monthly, whichever comes first. */
export const INTERVAL_DAYS = 30
/** "Depois" on the reminder buys this many days of quiet. */
export const SNOOZE_DAYS = 7

const FILE_NAME = 'second-brain-health.json'
const DAY_MS = 24 * 60 * 60 * 1000

export const EMPTY_RECORD: HealthRecord = {
  ingestsSinceLint: 0,
  lastLintAt: null,
  cycleStartedAt: null,
  snoozedUntil: null
}

/** Whole days elapsed from `iso` to `now`; null when `iso` isn't a usable date. */
function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS))
}

/**
 * Turns a stored ledger into the health the UI renders (SB-R10.1). Pure and
 * exported so the rule is unit-testable without touching disk — and so it has
 * exactly one implementation, in the main process.
 *
 * The two rules:
 *  - **count** — 10 ingests since the last health-check.
 *  - **calendar** — 30 days since the last health-check (or, when there has
 *    never been one, since the first ingest), *and* at least one ingest in that
 *    window. A base nobody has fed doesn't need tending, and nagging about it
 *    would teach the user to ignore the reminder.
 *
 * A snooze suppresses `due` but never erases `reason` — the panel still tells
 * the truth about the base while the ambient reminder stays quiet.
 */
export function deriveHealth(record: HealthRecord, now: Date = new Date()): VaultHealth {
  const daysSinceLint = daysSince(record.lastLintAt, now)
  const clockDays = daysSinceLint ?? daysSince(record.cycleStartedAt, now)

  const countDue = record.ingestsSinceLint >= INGEST_THRESHOLD
  const timeDue = clockDays !== null && clockDays >= INTERVAL_DAYS && record.ingestsSinceLint > 0
  const reason = countDue ? 'ingests' : timeDue ? 'time' : null

  const snoozeUntil = record.snoozedUntil === null ? null : Date.parse(record.snoozedUntil)
  const snoozed = snoozeUntil !== null && !Number.isNaN(snoozeUntil) && snoozeUntil > now.getTime()

  return {
    ingestsSinceLint: record.ingestsSinceLint,
    ingestThreshold: INGEST_THRESHOLD,
    intervalDays: INTERVAL_DAYS,
    lastLintAt: record.lastLintAt,
    daysSinceLint,
    daysUntilInterval: clockDays === null ? null : Math.max(0, INTERVAL_DAYS - clockDays),
    reason,
    due: reason !== null && !snoozed,
    snoozedUntil: snoozed ? record.snoozedUntil : null
  }
}

export interface SecondBrainHealthStore {
  /** SB-R10.1: the derived health for a workspace (never throws — no history reads as fresh). */
  get(workspace: string): VaultHealth
  /** SB-R10.2: records one ingest launched from Hive; returns the new health. */
  noteIngest(workspace: string): VaultHealth
  /** SB-R10.3: records a health-check run — resets the count, restarts both clocks. */
  noteLint(workspace: string): VaultHealth
  /** SB-R10.5: postpones the ambient reminder without pretending the check ran. */
  snooze(workspace: string, days?: number): VaultHealth
}

export interface HealthStoreDeps {
  /** Injected clock — keeps cadence tests deterministic (the `secondBrainVault.ts` convention). */
  now?: () => Date
}

/** Normalizes a hand-edited / older-schema entry into a usable record. */
function sanitize(value: unknown): HealthRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_RECORD }
  const raw = value as Partial<Record<keyof HealthRecord, unknown>>
  const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
  const count = typeof raw.ingestsSinceLint === 'number' ? Math.trunc(raw.ingestsSinceLint) : 0
  return {
    ingestsSinceLint: Number.isFinite(count) && count > 0 ? count : 0,
    lastLintAt: text(raw.lastLintAt),
    cycleStartedAt: text(raw.cycleStartedAt),
    snoozedUntil: text(raw.snoozedUntil)
  }
}

/**
 * Creates the health store, persisting `<baseDir>/second-brain-health.json` as
 * a `{ [workspacePath]: HealthRecord }` map. `baseDir` is injected (never read
 * from `electron.app` in here) so the module stays Electron-free and testable
 * against a temp dir — the `configStore.ts` pattern.
 */
export function createSecondBrainHealthStore(
  baseDir: string,
  deps: HealthStoreDeps = {}
): SecondBrainHealthStore {
  const now = deps.now ?? (() => new Date())
  const filePath = join(baseDir, FILE_NAME)

  function readAll(): Record<string, HealthRecord> {
    if (!existsSync(filePath)) return {}
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
      const out: Record<string, HealthRecord> = {}
      for (const [key, value] of Object.entries(parsed)) out[key] = sanitize(value)
      return out
    } catch {
      // Missing/corrupt/unreadable — treat as "no history", never throw. A lost
      // ledger costs one reminder, not the user's session.
      return {}
    }
  }

  function writeAll(all: Record<string, HealthRecord>): void {
    mkdirSync(baseDir, { recursive: true })
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmpPath, JSON.stringify(all, null, 2), 'utf-8')
    try {
      renameSync(tmpPath, filePath)
    } catch (err) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // best-effort cleanup
      }
      throw err
    }
  }

  /** Read → transform → persist → derive, the shape every mutation shares. */
  function mutate(workspace: string, change: (record: HealthRecord) => HealthRecord): VaultHealth {
    const all = readAll()
    const next = change(all[workspace] ?? { ...EMPTY_RECORD })
    all[workspace] = next
    try {
      writeAll(all)
    } catch {
      // A read-only userData dir must not break ingestion; the cadence simply
      // stops being remembered.
    }
    return deriveHealth(next, now())
  }

  return {
    get: (workspace) => deriveHealth(readAll()[workspace] ?? { ...EMPTY_RECORD }, now()),

    noteIngest: (workspace) =>
      mutate(workspace, (record) => ({
        ...record,
        ingestsSinceLint: record.ingestsSinceLint + 1,
        // The calendar clock starts at the first ingest of a cycle so a vault
        // that is never fed never goes "overdue".
        cycleStartedAt: record.cycleStartedAt ?? now().toISOString()
      })),

    // A health-check clears everything, including an active snooze: the user
    // did the thing the reminder asked for.
    noteLint: (workspace) => {
      const at = now().toISOString()
      return mutate(workspace, () => ({
        ingestsSinceLint: 0,
        lastLintAt: at,
        cycleStartedAt: null,
        snoozedUntil: null
      }))
    },

    snooze: (workspace, days = SNOOZE_DAYS) =>
      mutate(workspace, (record) => ({
        ...record,
        snoozedUntil: new Date(now().getTime() + days * DAY_MS).toISOString()
      }))
  }
}
