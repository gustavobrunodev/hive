import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { BrainIcon, FileTextIcon, MicIcon, WaveformIcon } from '../ui/icons'

/** Which ingestion mode the user picked from the FAB menu (SB-R3.1). */
export type IngestMode = 'text' | 'audioFile' | 'record'

interface SecondBrainFabProps {
  /** Opens the ingestion sheet on the chosen mode's tab. */
  onSelectMode: (mode: IngestMode) => void
}

const MODES: ReadonlyArray<{
  mode: IngestMode
  labelKey: 'fabText' | 'fabAudioFile' | 'fabRecord'
}> = [
  { mode: 'text', labelKey: 'fabText' },
  { mode: 'audioFile', labelKey: 'fabAudioFile' },
  { mode: 'record', labelKey: 'fabRecord' }
]

function modeIcon(mode: IngestMode): React.JSX.Element {
  if (mode === 'text') return <FileTextIcon size={16} />
  if (mode === 'audioFile') return <WaveformIcon size={16} />
  return <MicIcon size={16} />
}

/**
 * The floating ingestion button (SB-R3.1, SB-R3.5) — capture knowledge from
 * anywhere in the work UI without leaving flow.
 *
 * Placement: fixed, bottom-right, **outside** the resizable body so it never
 * disturbs the persisted `hive.workLayout`, and offset above the status bar so
 * it never covers the composer. Quiet by default (a single accent disc, no
 * label), it opens a three-item menu on activation and closes on Escape,
 * outside-click, or selection — returning focus to the button.
 *
 * The menu is hand-rolled rather than the DS `DropdownMenu` because it must
 * escape the work surface's stacking/overflow context reliably and stay
 * keyboard-simple (three items, roving focus); it still speaks the standard
 * `menu`/`menuitem` roles so it behaves like every other menu in the app.
 */
export function SecondBrainFab({ onSelectMode }: SecondBrainFabProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }, [])

  // Escape closes (focus returns to the trigger); a click outside dismisses.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close(true)
      }
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  const pick = useCallback(
    (mode: IngestMode) => {
      setOpen(false)
      onSelectMode(mode)
    },
    [onSelectMode]
  )

  return (
    <div className="wb-brain-fab-root" ref={rootRef}>
      {open && (
        <div className="wb-brain-fab-menu" role="menu" aria-label={t('secondBrain.fabMenuLabel')}>
          {MODES.map(({ mode, labelKey }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              className="wb-brain-fab-item"
              onClick={() => pick(mode)}
            >
              <span className="wb-brain-fab-item-icon" aria-hidden="true">
                {modeIcon(mode)}
              </span>
              {t(`secondBrain.${labelKey}`)}
            </button>
          ))}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="wb-brain-fab"
        data-tour="brain-fab"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('secondBrain.fabLabel')}
        aria-label={t('secondBrain.fabLabel')}
        onClick={() => setOpen((current) => !current)}
      >
        <BrainIcon size={20} />
      </button>
    </div>
  )
}
