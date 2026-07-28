import { t } from '../i18n'
import type { VaultHealth } from './useSecondBrain'

/**
 * Turns the derived health (SB-R10.1) into the sentences the panel and the
 * reminder show. Its own module — a `.tsx` exporting non-components trips
 * `react-refresh/only-export-components` (the `phaseCaption.ts` precedent) —
 * and pure, so the cadence copy is unit-testable without rendering anything.
 *
 * The rule itself is never re-derived here: `due`/`reason` arrive already
 * decided by the main process, and this module only phrases them.
 */

/** "Revisada há 12 dias" / "Revisada hoje" / "Nunca revisada". */
export function healthLastLintLabel(health: VaultHealth): string {
  if (health.lastLintAt === null || health.daysSinceLint === null) {
    return t('secondBrain.healthNeverLinted')
  }
  if (health.daysSinceLint === 0) return t('secondBrain.healthLintedToday')
  if (health.daysSinceLint === 1) return t('secondBrain.healthLintedYesterday')
  return t('secondBrain.healthLintedDays', health.daysSinceLint)
}

/** Why the base is (or, while snoozed, would be) due for a health-check. */
export function healthDueReason(health: VaultHealth): string {
  if (health.reason === 'ingests') {
    return t('secondBrain.healthDueIngests', health.ingestsSinceLint)
  }
  if (health.daysSinceLint === null) return t('secondBrain.healthDueNever')
  return t('secondBrain.healthDueTime', health.daysSinceLint)
}

/**
 * What still has to happen before the next health-check is due — the honest
 * counterpart to the reminder, so a healthy base says something useful instead
 * of nothing. `null` once it IS due (the reason takes over).
 */
export function healthNextLabel(health: VaultHealth): string | null {
  if (health.reason !== null) return null
  const ingests = Math.max(1, health.ingestThreshold - health.ingestsSinceLint)
  // The calendar rule only runs once the cycle has an ingest in it, so a
  // never-fed base is honestly described by the count alone.
  const days = health.ingestsSinceLint > 0 ? health.daysUntilInterval : null
  if (days === null) return t('secondBrain.healthNextIngests', ingests)
  return t('secondBrain.healthNextBoth', ingests, days)
}

/** Filled/total segments for the ingest meter (never overflows the track). */
export function healthMeter(health: VaultHealth): { filled: number; total: number } {
  const total = Math.max(1, health.ingestThreshold)
  return { filled: Math.min(total, Math.max(0, health.ingestsSinceLint)), total }
}
