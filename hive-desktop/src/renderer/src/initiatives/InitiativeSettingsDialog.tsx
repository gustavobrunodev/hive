import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  SegmentedControl,
  SwatchPicker
} from '@hive/design-system'
import { t } from '../i18n'
import { RELEASES, YEAR_SPAN, colorSwatches } from './initiativeChrome'
import { initiativePath, type Initiative, type InitiativeColor } from './initiatives'
import type { InitiativeEdit } from './useInitiatives'

export interface InitiativeSettingsDialogProps {
  /** The demand being edited. `null` keeps the dialog unmounted — nothing to edit. */
  initiative: Initiative | null
  onOpenChange: (open: boolean) => void
  /** Resolves with the initiative's path *after* the edit — different when the release moved. */
  onSave: (initiative: Initiative, edit: InitiativeEdit) => Promise<string>
  /** Called with the post-edit path, so whatever was holding the old one re-points. */
  onSaved: (path: string) => void
  onDelete: (initiative: Initiative) => Promise<void>
  /** Called once the folder is gone — the open initiative closes. */
  onDeleted: () => void
}

/**
 * Everything about an initiative that is not its artifacts: its name, the hue
 * that marks its conversations, where it sits in the year, and whether it
 * should exist at all.
 *
 * ## Why delete is in here and not on the row
 *
 * An initiative folder is where a demand's whole paper trail lives, and the
 * tree that lists them is a navigation surface people click through quickly.
 * A delete affordance on the row is a delete one slip away from the open
 * gesture next to it. Here it costs opening the demand's own settings first,
 * and then a confirmation that names what goes — which is the standard this
 * app already holds file deletion to.
 */
export function InitiativeSettingsDialog({
  initiative,
  onOpenChange,
  onSave,
  onSaved,
  onDelete,
  onDeleted
}: InitiativeSettingsDialogProps): React.JSX.Element | null {
  if (initiative === null) return null
  return (
    <SettingsForm
      // Remounts the form when the dialog is pointed at another demand, so the
      // draft below can be seeded from props once instead of being sync'd by an
      // effect that has to guess which change means "new subject".
      key={initiative.path}
      initiative={initiative}
      onOpenChange={onOpenChange}
      onSave={onSave}
      onSaved={onSaved}
      onDelete={onDelete}
      onDeleted={onDeleted}
    />
  )
}

type Problem = 'required' | 'duplicate' | 'failed' | 'deleteFailed'

function SettingsForm({
  initiative,
  onOpenChange,
  onSave,
  onSaved,
  onDelete,
  onDeleted
}: InitiativeSettingsDialogProps & { initiative: Initiative }): React.JSX.Element {
  const thisYear = new Date().getFullYear()
  const [title, setTitle] = useState(initiative.title)
  const [year, setYear] = useState(initiative.year)
  const [release, setRelease] = useState(initiative.release)
  const [color, setColor] = useState<InitiativeColor>(initiative.color)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  // Wide enough to hold a demand filed against last year, plus the release
  // folders that already exist — a demand somebody put in `hotfix` by hand must
  // still be editable without being silently refiled into `R1`.
  const years = Array.from({ length: YEAR_SPAN }, (_, index) => thisYear - YEAR_SPAN + 1 + index)
  const yearOptions = years.includes(initiative.year) ? years : [initiative.year, ...years]
  const releases = (RELEASES as readonly string[]).includes(initiative.release)
    ? RELEASES
    : [initiative.release, ...RELEASES]

  const movesTo = release === initiative.release ? null : initiativePath(release, initiative.slug)

  async function submit(): Promise<void> {
    if (title.trim() === '') return setProblem('required')
    setBusy(true)
    setProblem(null)
    try {
      const path = await onSave(initiative, { title: title.trim(), year, release, color })
      onOpenChange(false)
      onSaved(path)
    } catch (error) {
      setBusy(false)
      setProblem(
        error instanceof Error && error.name === 'InitiativeExistsError' ? 'duplicate' : 'failed'
      )
    }
  }

  async function confirmDelete(): Promise<void> {
    setBusy(true)
    setProblem(null)
    try {
      await onDelete(initiative)
      onOpenChange(false)
      onDeleted()
    } catch {
      setBusy(false)
      setConfirmingDelete(false)
      setProblem('deleteFailed')
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="wb-initedit">
        <DialogTitle>{t('initiatives.editTitle')}</DialogTitle>
        <DialogDescription>{t('initiatives.editDescription')}</DialogDescription>

        <div className="wb-newinit-form">
          <Field label={t('initiatives.nameLabel')}>
            <Input
              value={title}
              autoFocus
              onChange={(event) => {
                setTitle(event.target.value)
                if (problem !== null) setProblem(null)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void submit()
              }}
            />
          </Field>

          <Field label={t('initiatives.colorLabel')} description={t('initiatives.colorHint')}>
            <SwatchPicker
              size="md"
              ariaLabel={t('initiatives.colorPickerAria')}
              swatches={colorSwatches()}
              value={color}
              onChange={(id) => setColor(id as InitiativeColor)}
            />
          </Field>

          <div className="wb-newinit-row">
            <Field label={t('initiatives.yearLabel')}>
              <SegmentedControl
                ariaLabel={t('initiatives.yearLabel')}
                options={yearOptions.map((value) => ({ id: String(value), label: String(value) }))}
                value={String(year)}
                onChange={(id) => setYear(Number(id))}
              />
            </Field>
            <Field label={t('initiatives.releaseLabel')}>
              <SegmentedControl
                ariaLabel={t('initiatives.releaseLabel')}
                options={releases.map((value) => ({ id: value, label: value }))}
                value={release}
                onChange={setRelease}
              />
            </Field>
          </div>

          {/* A release change is a folder move. Said before it happens, because
              a path changing under an open editor tab is exactly the kind of
              surprise a dialog is supposed to spend a line preventing. */}
          {movesTo !== null && (
            <p className="wb-newinit-path">
              <span className="wb-newinit-path-label">
                {t('initiatives.moveNotice', initiative.path, movesTo)}
              </span>
            </p>
          )}

          {problem !== null && (
            <p className="wb-newinit-error" role="alert">
              {problem === 'required'
                ? t('initiatives.nameRequired')
                : problem === 'duplicate'
                  ? t('initiatives.duplicate')
                  : problem === 'deleteFailed'
                    ? t('initiatives.deleteFailed')
                    : t('initiatives.saveFailed')}
            </p>
          )}

          {confirmingDelete ? (
            // Inline, not a second Dialog: a confirmation stacked on a dialog
            // is a modal over a modal, and the thing it is confirming
            // disappears behind it exactly when the reader wants to check it.
            <div
              className="wb-initedit-confirm"
              role="alertdialog"
              aria-label={t('initiatives.deleteTitle')}
            >
              <p className="wb-initedit-confirm-title">{t('initiatives.deleteTitle')}</p>
              <p className="wb-initedit-confirm-body">
                {t('initiatives.deleteDescription', initiative.title)}
              </p>
              <div className="wb-dialog-actions">
                <Button
                  variant="ghost"
                  className="wb-btn"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t('initiatives.cancelCta')}
                </Button>
                <Button
                  className="wb-btn wb-btn-danger"
                  disabled={busy}
                  onClick={() => void confirmDelete()}
                >
                  {t('initiatives.deleteConfirmCta')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="wb-initedit-foot">
              <Button
                variant="ghost"
                className="wb-btn wb-initedit-delete"
                onClick={() => setConfirmingDelete(true)}
              >
                {t('initiatives.deleteCta')}
              </Button>
              <span className="wb-initedit-foot-spacer" />
              <Button variant="ghost" className="wb-btn" onClick={() => onOpenChange(false)}>
                {t('initiatives.cancelCta')}
              </Button>
              <Button
                className="wb-btn hds-btn-primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                {t('initiatives.saveCta')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
