import { t } from '../i18n'
import { GaugeIcon } from '../ui/icons'
import { healthDueReason } from './healthCopy'
import type { VaultHealth } from './useSecondBrain'

interface HealthNudgeProps {
  /**
   * The workspace's cadence — `null` before it lands. Self-gating (like
   * `VaultHealthCard`): nothing renders unless the base is actually due, so
   * callers hand it the store's health and never branch on it themselves.
   */
  health: VaultHealth | null
  /** "Revisar agora" — launches `/second-brain-lint` and records the run. */
  onLint: () => void
  /** "Depois" — a week of quiet, without pretending the check ran. */
  onSnooze: () => void
}

/**
 * The ambient health-check reminder (SB-R10.4) — the moment the app does the
 * remembering for the squad.
 *
 * It rides in the floating button's own stack, directly above the brain that
 * caused it, so the reminder appears where the fix is rather than as a banner
 * across the work. Quiet by construction: no backdrop, no focus steal, nothing
 * blocked. `role="status"` announces it once to a screen reader, in the flow of
 * whatever the user was already doing.
 *
 * Both answers are real: "Revisar agora" starts the agent session that fixes
 * it; "Depois" buys a week. Neither is a dead end — the panel's health card
 * keeps the same CTA available the whole time, which is what makes it fair to
 * let this one disappear.
 */
export function HealthNudge({
  health,
  onLint,
  onSnooze
}: HealthNudgeProps): React.JSX.Element | null {
  if (health === null || !health.due) return null

  return (
    <aside className="wb-brain-nudge" role="status" aria-label={t('secondBrain.healthDueTitle')}>
      <p className="wb-brain-nudge-title">
        <span className="wb-brain-nudge-glyph" aria-hidden="true">
          <GaugeIcon size={14} />
        </span>
        {t('secondBrain.healthDueTitle')}
      </p>
      <p className="wb-brain-nudge-body">{healthDueReason(health)}</p>
      <div className="wb-brain-nudge-actions">
        <button
          type="button"
          className="wb-brain-nudge-btn wb-brain-nudge-btn-primary"
          onClick={onLint}
        >
          {t('secondBrain.healthCta')}
        </button>
        <button type="button" className="wb-brain-nudge-btn" onClick={onSnooze}>
          {t('secondBrain.healthSnooze')}
        </button>
      </div>
    </aside>
  )
}
