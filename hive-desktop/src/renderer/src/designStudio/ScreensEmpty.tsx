import { Button, Empty } from '@hive/design-system'
import { t } from '../i18n'
import { LayersIcon, AlertTriangleIcon, SparkleIcon } from '../ui/icons'
import type { ScreenProbe, StudioOperationError } from './screens'

/**
 * Design Studio (M18) — T4.2. The two ways the stage can have nothing to show,
 * and neither of them is a blank stage (DS-R1 AC-3/5, design.md §3.10).
 *
 * The distinction that matters: "no Tela found" is not an error. The Spec was
 * read fine — it just does not name any surface in a form the Studio knows.
 * So the empty state does the one thing that turns a dead end into a next
 * step: it says **what it looked for**. A user who sees "we looked for `##
 * Tela — Name` and for an Information Architecture table" knows exactly which
 * two edits would make this work; a user who sees "no screens found" knows
 * nothing at all and closes the tab.
 */

/** Copy for each probe, in the detector's own order. */
const PROBE_LABEL: Record<ScreenProbe, () => string> = {
  screenHeading: () => t('designStudio.probeScreenHeading'),
  iaTable: () => t('designStudio.probeIaTable')
}

export interface ScreensEmptyProps {
  /** Every probe the detector ran — named one by one, never summarised. */
  probed: readonly ScreenProbe[]
  /** Opens the Spec in the normal editor so the user can make the edit. */
  onOpenSpec: () => void
}

export function ScreensEmpty({ probed, onOpenSpec }: ScreensEmptyProps): React.JSX.Element {
  return (
    <Empty
      className="wb-dstudio-empty"
      icon={<LayersIcon size={28} />}
      title={t('designStudio.emptyScreensTitle')}
      description={
        <>
          <span>{t('designStudio.emptyScreensDescription')}</span>
          <ul className="wb-dstudio-empty-probes">
            {probed.map((probe) => (
              <li key={probe}>{PROBE_LABEL[probe]()}</li>
            ))}
          </ul>
          <span>{t('designStudio.emptyScreensHint')}</span>
        </>
      }
      action={
        <Button variant="ghost" onClick={onOpenSpec}>
          {t('designStudio.emptyScreensAction')}
        </Button>
      }
    />
  )
}

export interface ScreenEmptyProps {
  /** Opens the Árvore's add picker — the empty state's own second way in. */
  onAddComponent: () => void
  /** T6.2 / DS-R2: runs the Skill over the Spec for this Tela. */
  onGenerate: () => void
}

/**
 * T5.7 / DS-R7, design §3.10: a Tela with no Components at all. The stage says
 * so and offers **both** ways to fill it — generating with the Skill, which is
 * how most Telas start, and adding a Component by hand, which is how a user who
 * already knows what they want starts.
 */
export function ScreenEmpty({ onAddComponent, onGenerate }: ScreenEmptyProps): React.JSX.Element {
  return (
    <Empty
      className="wb-dstudio-empty"
      icon={<SparkleIcon size={28} />}
      title={t('designStudio.screenEmptyTitle')}
      description={t('designStudio.screenEmptyDescription')}
      action={
        <span className="wb-dstudio-empty-actions">
          <Button onClick={onGenerate}>{t('designStudio.screenEmptyGenerate')}</Button>
          <Button variant="ghost" onClick={onAddComponent}>
            {t('designStudio.treeAddLabel')}
          </Button>
        </span>
      }
    />
  )
}

export interface SpecLoadErrorProps {
  error: StudioOperationError
  onRetry: () => void
}

/**
 * DS-R1 AC-5 / DS-R17: an unreadable Spec is an `OperationError`, and
 * `retryable: true` is rendered as a button — a retryable failure the user
 * cannot retry is just a nicer-sounding dead end.
 */
export function SpecLoadError({ error, onRetry }: SpecLoadErrorProps): React.JSX.Element {
  return (
    <Empty
      className="wb-dstudio-empty"
      icon={<AlertTriangleIcon size={28} />}
      title={t('designStudio.specErrorTitle')}
      description={error.message}
      action={
        error.retryable ? (
          <Button variant="ghost" onClick={onRetry}>
            {t('designStudio.specErrorRetry')}
          </Button>
        ) : undefined
      }
    />
  )
}
