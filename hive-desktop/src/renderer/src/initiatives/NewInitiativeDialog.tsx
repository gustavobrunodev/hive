import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  SegmentedControl
} from '@hive/design-system'
import { t } from '../i18n'
import { initiativePath, initiativeSlug } from './initiatives'

/**
 * The releases a demand can be planted in.
 *
 * Four, because that is what the team ships in a year. They are offered as a
 * segmented control rather than a free text field for the same reason a month
 * is a picker: `R2` and `r2` and `R 2` would be three different folders on
 * disk, and the tree would show three different releases — a typo nobody sees
 * until the demand is missing from where they looked.
 */
const RELEASES = ['R1', 'R2', 'R3', 'R4'] as const

/** How many years back the picker offers. Enough for last year's tail end, not an archive. */
const YEAR_SPAN = 2

export interface NewInitiativeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves once the folder exists; rejects with `InitiativeExistsError` on a name collision. */
  onCreate: (draft: { title: string; year: number; release: string }) => Promise<string>
  /** The freshly created initiative's folder — the caller opens it. */
  onCreated: (path: string) => void
}

type Problem = 'required' | 'unusable' | 'duplicate' | 'failed'

export function NewInitiativeDialog({
  open,
  onOpenChange,
  onCreate,
  onCreated
}: NewInitiativeDialogProps): React.JSX.Element {
  const thisYear = new Date().getFullYear()
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(thisYear)
  const [release, setRelease] = useState<string>(RELEASES[0])
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState(false)

  const slug = initiativeSlug(title)
  const years = Array.from({ length: YEAR_SPAN }, (_, index) => thisYear - YEAR_SPAN + 1 + index)

  function reset(): void {
    setTitle('')
    setYear(thisYear)
    setRelease(RELEASES[0])
    setProblem(null)
    setBusy(false)
  }

  async function submit(): Promise<void> {
    if (title.trim() === '') return setProblem('required')
    if (slug === '') return setProblem('unusable')
    setBusy(true)
    setProblem(null)
    try {
      const path = await onCreate({ title: title.trim(), year, release })
      reset()
      onOpenChange(false)
      onCreated(path)
    } catch (error) {
      setBusy(false)
      setProblem(
        error instanceof Error && error.name === 'InitiativeExistsError' ? 'duplicate' : 'failed'
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="wb-newinit">
        <DialogTitle>{t('initiatives.createTitle')}</DialogTitle>
        <DialogDescription>{t('initiatives.createDescription')}</DialogDescription>

        <div className="wb-newinit-form">
          <Field label={t('initiatives.nameLabel')}>
            <Input
              value={title}
              autoFocus
              placeholder={t('initiatives.namePlaceholder')}
              onChange={(event) => {
                setTitle(event.target.value)
                if (problem !== null) setProblem(null)
              }}
              // The name is the only field anyone types into, so Enter in it is
              // the gesture — a two-control form where the keyboard cannot
              // finish is a form that makes you reach for the mouse to agree
              // with the defaults it already picked.
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void submit()
              }}
            />
          </Field>

          <div className="wb-newinit-row">
            <Field label={t('initiatives.yearLabel')}>
              <SegmentedControl
                ariaLabel={t('initiatives.yearLabel')}
                options={years.map((value) => ({ id: String(value), label: String(value) }))}
                value={String(year)}
                onChange={(id) => setYear(Number(id))}
              />
            </Field>
            <Field label={t('initiatives.releaseLabel')}>
              <SegmentedControl
                ariaLabel={t('initiatives.releaseLabel')}
                options={RELEASES.map((value) => ({ id: value, label: value }))}
                value={release}
                onChange={setRelease}
              />
            </Field>
          </div>

          {/* The folder, live. A slug is a silent transformation — accents
              folded, spaces hyphenated — and the first place anyone would
              notice it went somewhere unexpected is the day they cannot find
              the demand in the file tree. */}
          <p className="wb-newinit-path">
            <span className="wb-newinit-path-label">{t('initiatives.pathPreview')}</span>
            <code className="wb-newinit-path-value">
              {initiativePath(release, slug === '' ? '…' : slug)}
            </code>
          </p>

          {problem !== null && (
            <p className="wb-newinit-error" role="alert">
              {problem === 'required'
                ? t('initiatives.nameRequired')
                : problem === 'unusable'
                  ? t('initiatives.nameUnusable')
                  : problem === 'duplicate'
                    ? t('initiatives.duplicate')
                    : t('initiatives.createFailed')}
            </p>
          )}

          <div className="wb-dialog-actions">
            <Button
              variant="ghost"
              className="wb-btn"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              {t('initiatives.cancelCta')}
            </Button>
            <Button
              className="wb-btn hds-btn-primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              {t('initiatives.createCta')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
