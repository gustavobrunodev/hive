import { Button, Empty, Skeleton } from '@hive/design-system'
import { t } from '../i18n'
import { AlertTriangleIcon } from '../ui/icons'
import type { CapabilityViolation } from './documentModel'
import type { StudioOperationError } from './screens'
import type { SkillPhase } from './skillRun'

/**
 * Design Studio (M18) — T6.2. What the stage shows while the Skill works, and
 * what it shows when the Skill could not.
 *
 * DS-R2 says every async wait is covered by a **visible state**, and design.md
 * §3.9 says the shape of that state is a `Skeleton`, never a spinner: a
 * skeleton is the outline of what is coming, which is information; a spinner is
 * a token that says "wait", which is not.
 *
 * The status line beside it is `aria-live="polite"` because the phase changes
 * with nothing else on screen changing — a sighted user reads the new sentence,
 * and without the live region a screen-reader user would read nothing at all.
 */

const PHASE_LABEL: Record<SkillPhase, () => string> = {
  reading: () => t('designStudio.skillPhaseReading'),
  choosing: () => t('designStudio.skillPhaseChoosing'),
  composing: () => t('designStudio.skillPhaseComposing')
}

export interface SkillProgressProps {
  phase: SkillPhase
}

export function SkillProgress({ phase }: SkillProgressProps): React.JSX.Element {
  return (
    <div className="wb-dstudio-stage" aria-busy="true" aria-label={t('designStudio.skillRunning')}>
      <div className="wb-dstudio-skill-progress">
        <Skeleton className="wb-dstudio-stage-skeleton" />
        <p className="wb-dstudio-skill-status" role="status" aria-live="polite">
          {PHASE_LABEL[phase]()}
        </p>
      </div>
    </div>
  )
}

export interface SkillFailureViewProps {
  failure: StudioOperationError | CapabilityViolation
  /** Re-runs the request. Offered only for a retryable `OperationError`. */
  onRetry: () => void
}

/**
 * The two failures read differently on purpose. An `OperationError` is a bad
 * turn and gets **Tentar de novo**, because trying again is genuinely likely to
 * work. A `CapabilityViolation` is a true statement about the active Design
 * System, and offering a retry there would just be inviting the same refusal —
 * so it names the Component that could not be built instead (design.md §6).
 */
export function SkillFailureView({ failure, onRetry }: SkillFailureViewProps): React.JSX.Element {
  const isOperation = failure.kind === 'operation'
  return (
    <Empty
      className="wb-dstudio-empty"
      icon={<AlertTriangleIcon size={28} />}
      title={
        isOperation ? t('designStudio.skillErrorTitle') : t('designStudio.skillViolationTitle')
      }
      description={isOperation ? failure.message : failure.reason}
      action={
        isOperation && failure.retryable ? (
          <Button variant="ghost" onClick={onRetry}>
            {t('designStudio.skillRetry')}
          </Button>
        ) : undefined
      }
    />
  )
}
