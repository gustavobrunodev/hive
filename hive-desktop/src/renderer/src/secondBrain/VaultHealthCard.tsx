import { t } from '../i18n'
import { GaugeIcon } from '../ui/icons'
import { healthDueReason, healthLastLintLabel, healthMeter, healthNextLabel } from './healthCopy'
import type { VaultHealth } from './useSecondBrain'

interface VaultHealthCardProps {
  /** Derived cadence for the active workspace; `null` before the first fetch lands. */
  health: VaultHealth | null
  /** Launches `/second-brain-lint` (and records the run). */
  onLint: () => void
  /** Postpones the ambient reminder for a week — shown only while it's due. */
  onSnooze: () => void
}

/** The 10-segment ingest meter — a count you can read without reading (SB-R10.1). */
function IngestMeter({ health }: { health: VaultHealth }): React.JSX.Element {
  const { filled, total } = healthMeter(health)
  return (
    <div
      className="wb-brain-health-meter"
      role="img"
      aria-label={t('secondBrain.healthMeterAria', filled, total)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="wb-brain-health-seg"
          data-filled={index < filled || undefined}
          // Per-segment transition delay: after an ingest the meter fills
          // left-to-right instead of snapping (see `--seg` in workbench.css).
          style={{ '--seg': index } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/**
 * **Saúde da base** (SB-R10.1/10.4) — the panel's standing answer to "does the
 * knowledge base need tending?", so the practice the `second-brain` skill
 * documents ("run `/second-brain-lint` after every 10 ingests or monthly")
 * stops depending on anybody remembering it.
 *
 * Healthy, it is three quiet lines: the meter, where the count stands, and what
 * would make it due. Due, the same block turns into the ask — reason first,
 * then "Revisar agora". Nothing appears or disappears between the two states,
 * so the card never becomes a surprise; it just changes its mind about what
 * matters.
 *
 * A snooze silences the floating reminder, never this card: postponing is not
 * the same as being fine, and the panel is where the truth stays available.
 */
export function VaultHealthCard({
  health,
  onLint,
  onSnooze
}: VaultHealthCardProps): React.JSX.Element | null {
  if (health === null) return null

  const due = health.due
  const snoozed = health.snoozedUntil !== null
  const next = healthNextLabel(health)

  return (
    <section
      className="wb-brain-health"
      data-due={due || undefined}
      aria-label={t('secondBrain.healthTitle')}
    >
      <h3 className="wb-brain-section-title" title={t('secondBrain.healthPractice')}>
        <GaugeIcon size={13} className="wb-brain-health-icon" />
        {due ? t('secondBrain.healthDueTitle') : t('secondBrain.healthTitle')}
      </h3>

      <IngestMeter health={health} />

      {due ? (
        <p className="wb-brain-health-reason">{healthDueReason(health)}</p>
      ) : (
        <p className="wb-brain-health-row">
          <span className="wb-brain-health-count">
            {t('secondBrain.healthCount', health.ingestsSinceLint, health.ingestThreshold)}
          </span>
          <span className="wb-brain-health-since">{healthLastLintLabel(health)}</span>
        </p>
      )}

      {snoozed && <p className="wb-brain-health-note">{t('secondBrain.healthSnoozed')}</p>}
      {!due && next !== null && <p className="wb-brain-health-note">{next}</p>}

      {/* Only a base that needs tending gets its own CTA here: while it's
          healthy the action row above already carries "Revisar", and a second
          copy of it would be one affordance pretending to be two. */}
      {health.reason !== null && (
        <div className="wb-brain-health-actions">
          <button
            type="button"
            className="wb-brain-health-btn"
            data-primary={due || undefined}
            onClick={onLint}
          >
            {t('secondBrain.healthCta')}
          </button>
          {due && (
            <button type="button" className="wb-brain-health-btn" onClick={onSnooze}>
              {t('secondBrain.healthSnooze')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
