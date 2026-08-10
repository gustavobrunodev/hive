import { useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@hive/design-system'
import { t } from '../i18n'
import type { DetectedScreen } from './screens'
import { failedOutcomes, type ExportRun } from './exportModel'

/**
 * Design Studio (M18) — T7.4. Choosing what to export, and reading what came of
 * it (DS-R14 AC-3/4, DS-R15).
 *
 * The dialog exists because the export takes **two** decisions — which Telas,
 * and where — and only the second one has a native picker. Exporting straight
 * off the toolbar button would silently mean "the active Tela", which is right
 * often enough to be a trap: the user who wanted all five finds out one file
 * later.
 *
 * The report is the same surface rather than a toast, because a batch can be
 * partly good (DS-R15) and a toast has nowhere to put "these four landed, this
 * one did not, here is why". A failed Tela keeps its `OperationError` — the
 * only failure shape an export is allowed (DS-R17) — and the primary button
 * becomes "export again", which runs the same selection.
 *
 * It is **mounted while it is open**, so the selection is seeded from the Tela
 * in view every time rather than remembered from a run the user has forgotten
 * making.
 *
 * **Nothing here dispatches a Command.** Exporting is a read: the undo cursor
 * does not move and the Tela's session is untouched (DS-R14 AC-3).
 */

export interface ExportDialogProps {
  onClose: () => void
  screens: DetectedScreen[]
  /** Pre-selected on open — the Tela the user is looking at. */
  activeScreenId: string | null
  /** Runs the export for the chosen Telas; resolves to the whole report. */
  onExport: (screenIds: string[]) => Promise<ExportRun>
}

export function ExportDialog({
  onClose,
  screens,
  activeScreenId,
  onExport
}: ExportDialogProps): React.JSX.Element {
  const [chosen, setChosen] = useState<readonly string[]>(
    activeScreenId === null ? [] : [activeScreenId]
  )
  const [run, setRun] = useState<ExportRun | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (screenId: string, checked: boolean): void =>
    setChosen((current) =>
      checked ? [...current, screenId] : current.filter((id) => id !== screenId)
    )

  const start = async (): Promise<void> => {
    setBusy(true)
    try {
      // In the Telas' own order, not in click order: the report reads like the
      // list the user just looked at.
      const result = await onExport(
        screens.map((screen) => screen.screenId).filter((id) => chosen.includes(id))
      )
      // A closed folder picker leaves the dialog as it was, with the selection
      // intact — the user cancelled a folder, not the export.
      if (!result.canceled) setRun(result)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="wb-dstudio-export-dialog">
        <DialogTitle>{t('designStudio.exportDialogTitle')}</DialogTitle>
        <DialogDescription>{t('designStudio.exportDialogDescription')}</DialogDescription>
        {run === null ? (
          <ExportPicker screens={screens} chosen={chosen} onToggle={toggle} />
        ) : (
          <ExportReport run={run} />
        )}
        <div className="wb-dialog-actions">
          <Button className="wb-btn" onClick={onClose}>
            {run === null ? t('designStudio.exportCancel') : t('designStudio.exportClose')}
          </Button>
          <Button
            className="wb-btn hds-btn-primary"
            disabled={chosen.length === 0 || busy}
            onClick={() => void start()}
          >
            {run === null ? t('designStudio.exportConfirm') : t('designStudio.exportAgain')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The Telas, each one a checkbox — DS-R15's "várias Telas" made explicit. */
function ExportPicker({
  screens,
  chosen,
  onToggle
}: {
  screens: DetectedScreen[]
  chosen: readonly string[]
  onToggle: (screenId: string, checked: boolean) => void
}): React.JSX.Element {
  return (
    <ul className="wb-dstudio-export-list" aria-label={t('designStudio.exportListAria')}>
      {screens.map((screen) => (
        <li key={screen.screenId}>
          <label className="wb-dstudio-export-item">
            <Checkbox
              checked={chosen.includes(screen.screenId)}
              onCheckedChange={(next) => onToggle(screen.screenId, next === true)}
              aria-label={t('designStudio.exportScreenAria', screen.title)}
            />
            <span>{screen.title}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

/**
 * What the run produced. The count and the folder first — that is the answer to
 * "did it work?" — and then, only if there are any, the Telas that did not make
 * it, each with the reason it gave.
 */
function ExportReport({ run }: { run: ExportRun }): React.JSX.Element {
  const failures = failedOutcomes(run.outcomes)
  const written = run.outcomes.length - failures.length
  return (
    <div className="wb-dstudio-export-report" role="status">
      <p className="wb-dstudio-export-count">
        {t('designStudio.exportDone', written, run.outDir ?? '')}
      </p>
      {failures.length > 0 && (
        <ul className="wb-dstudio-export-failures">
          {failures.map((failure) => (
            <li key={failure.screenId}>
              <span className="wb-dstudio-export-failed-title">{failure.title}</span>
              <span className="wb-dstudio-export-failed-reason">{failure.error.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
