import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Textarea
} from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import type { IngestMode } from './SecondBrainFab'
import type { SecondBrainStore } from './useSecondBrain'
import { SECOND_BRAIN_INGEST, SECOND_BRAIN_SETUP } from './secondBrainPrompts'
import { AudioFileTab } from './whisper/AudioFileTab'
import { DEFAULT_MODEL, useWhisper, type WhisperModelId } from './whisper/useWhisper'

/** Catalog entry as the bridge returns it (renderer never imports `src/main/*`). */
type WhisperModelInfo = Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]

interface IngestPanelProps {
  /** The mode the FAB opened on, or null when the sheet is closed. */
  mode: IngestMode | null
  /** Closes the sheet. */
  onClose: () => void
  /** Vault status for the active workspace (drives the no-vault guard, SB-R3.3). */
  store: SecondBrainStore
  /** Launches a slash command through the chat (D-SB-5). */
  onLaunch: (action: RoleAction) => void
}

const TABS: ReadonlyArray<{
  mode: IngestMode
  labelKey: 'fabText' | 'fabAudioFile' | 'fabRecord'
}> = [
  { mode: 'text', labelKey: 'fabText' },
  { mode: 'audioFile', labelKey: 'fabAudioFile' },
  { mode: 'record', labelKey: 'fabRecord' }
]

/**
 * The ingestion sheet (SB-R3.2–3.4) — one editable field and one **Ingerir**
 * action shared by all three capture modes, so pasted text and a transcript
 * take the exact same path: write the content to the vault's `raw/` inbox, then
 * launch `/second-brain-ingest` so the agent files it into the wiki (D-SB-5).
 *
 * Guards: an empty field disables the confirm (SB-R3.4), and with no vault the
 * sheet offers "Configurar base" instead of writing to a missing path
 * (SB-R3.3). The audio tabs are placeholders here; Phase 4/5 fill them with the
 * Whisper pipeline and the recorder, both feeding this same field.
 */
export function IngestPanel({
  mode,
  onClose,
  store,
  onLaunch
}: IngestPanelProps): React.JSX.Element {
  const [activeMode, setActiveMode] = useState<IngestMode>('text')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Whisper (SB-R4.4): the selected model, defaulting to `base` (D-SB-4), and
  // the catalog for the picker (loaded lazily once the sheet opens).
  const [model, setModel] = useState<WhisperModelId>(DEFAULT_MODEL)
  const [models, setModels] = useState<WhisperModelInfo[]>([])
  const whisper = useWhisper()

  // The sheet is open whenever the FAB handed it a mode; opening re-syncs the
  // active tab to that mode (derived during render, no effect — the
  // react-hooks/set-state-in-effect rule).
  const open = mode !== null
  const [lastMode, setLastMode] = useState<IngestMode | null>(null)
  if (mode !== null && mode !== lastMode) {
    setLastMode(mode)
    setActiveMode(mode)
  }
  if (mode === null && lastMode !== null) setLastMode(null)

  // The catalog only matters once the sheet is open, and it changes when a
  // model is downloaded — refetch on open rather than holding it app-wide.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.hive.whisper.listModels().then((list) => {
      if (!cancelled) setModels(list)
    })
    return () => {
      cancelled = true
    }
  }, [open, whisper.phase.status])

  const close = useCallback(() => {
    setContent('')
    setError(null)
    onClose()
  }, [onClose])

  const ingest = useCallback(() => {
    if (content.trim() === '') return
    setBusy(true)
    setError(null)
    void window.hive.secondBrain
      .stageRaw(store.workspace, content)
      .then(() => {
        onLaunch(SECOND_BRAIN_INGEST)
        store.refresh()
        setBusy(false)
        close()
      })
      .catch(() => {
        setBusy(false)
        setError(t('secondBrain.ingestError'))
      })
  }, [content, store, onLaunch, close])

  return (
    <Sheet open={open} onOpenChange={(next: boolean) => !next && close()}>
      <SheetContent side="right" className="wb-brain-ingest">
        <SheetTitle>{t('secondBrain.ingestTitle')}</SheetTitle>
        <SheetDescription>{t('secondBrain.ingestDescription')}</SheetDescription>

        {!store.hasVault ? (
          <div className="wb-brain-ingest-guard">
            <p className="wb-brain-ingest-guard-title">{t('secondBrain.ingestNoVaultTitle')}</p>
            <p className="wb-brain-ingest-guard-desc">
              {t('secondBrain.ingestNoVaultDescription')}
            </p>
            <Button
              cut={false}
              className="wb-btn"
              onClick={() => {
                onLaunch(SECOND_BRAIN_SETUP)
                close()
              }}
            >
              {t('secondBrain.emptyCta')}
            </Button>
          </div>
        ) : (
          <>
            <div
              className="wb-brain-ingest-tabs"
              role="tablist"
              aria-label={t('secondBrain.fabMenuLabel')}
            >
              {TABS.map(({ mode: tabMode, labelKey }) => (
                <button
                  key={tabMode}
                  type="button"
                  role="tab"
                  id={`wb-ingest-tab-${tabMode}`}
                  aria-selected={activeMode === tabMode}
                  aria-controls={`wb-ingest-panel-${tabMode}`}
                  className="wb-brain-ingest-tab"
                  data-active={activeMode === tabMode || undefined}
                  onClick={() => setActiveMode(tabMode)}
                >
                  {t(`secondBrain.${labelKey}`)}
                </button>
              ))}
            </div>

            <div
              className="wb-brain-ingest-body"
              role="tabpanel"
              id={`wb-ingest-panel-${activeMode}`}
              aria-labelledby={`wb-ingest-tab-${activeMode}`}
            >
              {activeMode === 'audioFile' && (
                <AudioFileTab
                  phase={whisper.phase}
                  transcribe={(pcm) => whisper.transcribe(pcm, { model })}
                  onStart={() => setError(null)}
                  onTranscript={setContent}
                  onError={setError}
                />
              )}
              {activeMode === 'record' && (
                <p className="wb-brain-ingest-soon">{t('secondBrain.ingestAudioSoon')}</p>
              )}

              {/* One editable transcript field, shared by every mode: typed
                  text lands here directly, and a transcription fills it so the
                  user can correct it before ingesting (SB-R4.3/4.5). */}
              <Textarea
                className="wb-brain-ingest-textarea"
                value={content}
                placeholder={t('secondBrain.ingestTextPlaceholder')}
                aria-label={
                  activeMode === 'text'
                    ? t('secondBrain.ingestTextPlaceholder')
                    : t('secondBrain.ingestTranscriptLabel')
                }
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setContent(event.target.value)
                }
              />
            </div>

            {activeMode !== 'text' && (
              <div className="wb-brain-ingest-model">
                <label className="wb-brain-ingest-model-label" htmlFor="wb-ingest-model">
                  {t('secondBrain.ingestModelLabel')}
                </label>
                <select
                  id="wb-ingest-model"
                  className="wb-brain-ingest-model-select"
                  value={model}
                  onChange={(event) => setModel(event.target.value as WhisperModelId)}
                >
                  {models.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id} · {entry.params}
                      {entry.downloaded ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="wb-brain-ingest-error" role="alert">
                {error}
              </p>
            )}

            <div className="wb-brain-ingest-actions">
              <Button cut={false} variant="ghost" className="wb-btn" onClick={close}>
                {t('secondBrain.ingestCancel')}
              </Button>
              <Button
                cut={false}
                className="wb-btn"
                disabled={content.trim() === '' || busy}
                onClick={ingest}
              >
                {busy ? t('secondBrain.ingestStaging') : t('secondBrain.ingestConfirm')}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
