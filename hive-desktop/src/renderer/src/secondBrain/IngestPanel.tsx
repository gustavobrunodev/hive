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
import type { BrainSetup } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import { VaultGuard } from './VaultGuard'
import { secondBrainIngest } from './secondBrainPrompts'
import { AudioFileTab } from './whisper/AudioFileTab'
import { AudioJobList } from './whisper/AudioJobList'
import { AudioRecorder } from './whisper/AudioRecorder'
import { EngineProgress } from './whisper/EngineProgress'
import { useAudioIngest } from './whisper/useAudioIngest'
import { enginePhaseView } from './whisper/enginePhase'
import { ModelManager } from './whisper/ModelManager'
import {
  DEFAULT_MODEL,
  probeWebGpu,
  useWhisper,
  type WhisperModelId,
  type WhisperVariant
} from './whisper/useWhisper'

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
  /** The vault-setup flow — drives the no-vault guard's two states (SB-R3.3). */
  setup: BrainSetup
}

const TABS: ReadonlyArray<{
  mode: IngestMode
  labelKey: 'fabText' | 'fabAudioFile' | 'fabRecord'
}> = [
  { mode: 'text', labelKey: 'fabText' },
  { mode: 'audioFile', labelKey: 'fabAudioFile' },
  { mode: 'record', labelKey: 'fabRecord' }
]

/** Why **Ingerir** cannot run yet — `null` means it can. */
type IngestBlock = 'empty' | 'working' | null

/**
 * The sentence beside the confirm button. Always present, in all three states,
 * so the space does not appear and disappear as the user types — and so the
 * blocked case is a message rather than an absence.
 */
function blockHint(block: IngestBlock, mode: IngestMode): string {
  if (block === null) return t('secondBrain.ingestReady')
  if (block === 'working') return t('secondBrain.ingestBlockedWorking')
  return mode === 'text'
    ? t('secondBrain.ingestBlockedEmptyText')
    : t('secondBrain.ingestBlockedEmptyAudio')
}

/** The three capture-mode tabs (extracted to keep `IngestPanel` within its complexity budget). */
function ModeTabs({
  activeMode,
  onSelect
}: {
  activeMode: IngestMode
  onSelect: (mode: IngestMode) => void
}): React.JSX.Element {
  return (
    <div className="wb-brain-ingest-tabs" role="tablist" aria-label={t('secondBrain.fabMenuLabel')}>
      {TABS.map(({ mode, labelKey }) => (
        <button
          key={mode}
          type="button"
          role="tab"
          id={`wb-ingest-tab-${mode}`}
          aria-selected={activeMode === mode}
          aria-controls={`wb-ingest-panel-${mode}`}
          className="wb-brain-ingest-tab"
          data-active={activeMode === mode || undefined}
          onClick={() => onSelect(mode)}
        >
          {t(`secondBrain.${labelKey}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * The active capture affordance. Typed text has none — the shared field below
 * *is* the whole interface there — while both audio modes hand their blobs to
 * the same queue, which is what keeps an upload and a recording identical from
 * the moment they produce sound.
 */
function CaptureArea({
  mode,
  busy,
  onCapture
}: {
  mode: IngestMode
  busy: boolean
  onCapture: (items: ReadonlyArray<{ blob: Blob; name: string }>) => void
}): React.JSX.Element | null {
  if (mode === 'text') return null
  if (mode === 'audioFile') {
    return (
      <AudioFileTab
        busy={busy}
        onFiles={(files) => onCapture(files.map((file) => ({ blob: file, name: file.name })))}
      />
    )
  }
  return (
    <AudioRecorder
      busy={busy}
      onRecorded={(blob) =>
        onCapture([{ blob, name: t('secondBrain.recordTakeName', new Date()) }])
      }
    />
  )
}

/**
 * The editable transcript — shown in the audio modes only once there is
 * something to edit.
 *
 * An empty 220px box under a recorder was answering a question nobody asked:
 * before a take exists there is nothing to type into it, and its presence
 * suggested typing was part of recording. After transcription it is essential,
 * because a local model's output always wants a human pass.
 */
function TranscriptEditor({
  mode,
  content,
  onChange
}: {
  mode: IngestMode
  content: string
  onChange: (next: string) => void
}): React.JSX.Element | null {
  const isText = mode === 'text'
  if (!isText && content === '') return null
  const label = isText
    ? t('secondBrain.ingestTextPlaceholder')
    : t('secondBrain.ingestTranscriptLabel')
  return (
    <div className="wb-brain-ingest-field">
      {!isText && (
        <div className="wb-brain-ingest-field-head">
          <label className="wb-brain-ingest-field-label" htmlFor="wb-ingest-transcript">
            {label}
          </label>
          <span className="wb-brain-ingest-count">
            {t('secondBrain.ingestCharCount', content.trim().length)}
          </span>
        </div>
      )}
      <Textarea
        id="wb-ingest-transcript"
        className="wb-brain-ingest-textarea"
        value={content}
        placeholder={t('secondBrain.ingestTextPlaceholder')}
        aria-label={label}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
    </div>
  )
}

/** Model picker + manager entry, only meaningful where audio is involved (SB-R4.4). */
function ModelRow({
  model,
  models,
  onSelect,
  onManage
}: {
  model: WhisperModelId
  models: WhisperModelInfo[]
  onSelect: (id: WhisperModelId) => void
  onManage: () => void
}): React.JSX.Element {
  return (
    <div className="wb-brain-ingest-model">
      <label className="wb-brain-ingest-model-label" htmlFor="wb-ingest-model">
        {t('secondBrain.ingestModelLabel')}
      </label>
      <select
        id="wb-ingest-model"
        className="wb-brain-ingest-model-select"
        value={model}
        onChange={(event) => onSelect(event.target.value as WhisperModelId)}
      >
        {models.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.id} · {entry.params}
            {entry.downloaded ? ' ✓' : ''}
          </option>
        ))}
      </select>
      <button type="button" className="wb-brain-ingest-manage" onClick={onManage}>
        {t('secondBrain.ingestManageModels')}
      </button>
    </div>
  )
}

/**
 * The ingestion sheet (SB-R3.2–3.4) — three capture modes feeding one editable
 * field and one **Ingerir** action, so pasted text and a transcript take the
 * exact same path: write the content to the vault's `raw/` inbox, then launch
 * `/second-brain-ingest` **with that text** so the transcript shows what was
 * actually sent and the agent files it into the wiki (D-SB-5).
 *
 * Guards: with no vault the sheet offers "Configurar base" instead of writing
 * to a missing path (SB-R3.3), and **Ingerir** stays blocked — with the reason
 * stated in words next to it — while there is nothing to send or while the
 * engine is still working (SB-R3.4).
 */
export function IngestPanel({
  mode,
  onClose,
  store,
  onLaunch,
  setup
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

  // Every finished transcript is appended under a heading naming its source.
  // Two voice memos and a meeting recording become one reviewable document,
  // and the wiki page the agent writes keeps the attribution.
  const appendTranscript = useCallback((text: string, name: string) => {
    if (text.trim() === '') return
    setContent((current) =>
      current.trim() === '' ? text : `${current.trim()}\n\n## ${name}\n\n${text}`
    )
  }, [])

  // One audio→transcript queue for both the file picker and the recorder
  // (SB-R4.5 / SB-R5.5), so an upload and a recording behave identically.
  const queue = useAudioIngest(whisper, model, appendTranscript)
  const engineBusy = whisper.phase.status !== 'idle' && whisper.phase.status !== 'error'
  const working = engineBusy || queue.busy
  const phaseView = enginePhaseView(whisper.phase)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [engineVariant, setEngineVariant] = useState<WhisperVariant>('fp32')

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

  // Which precision this machine will actually download/run. fp32 is the safe
  // default until a WebGPU adapter is confirmed — it's the only variant that
  // builds a session on the WASM backend (T2 spike).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void probeWebGpu().then((gpu) => {
      if (!cancelled) setEngineVariant(gpu ? 'q8' : 'fp32')
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const close = useCallback(() => {
    setContent('')
    setError(null)
    onClose()
  }, [onClose])

  const block: IngestBlock = working ? 'working' : content.trim() === '' ? 'empty' : null

  const ingest = useCallback(() => {
    if (content.trim() === '') return
    setBusy(true)
    setError(null)
    void window.hive.secondBrain
      .stageRaw(store.workspace, content)
      .then(({ relPath }) => {
        // The staged path AND the text ride on the launch: the path pins the
        // skill to this file, the text makes the turn legible in the chat.
        onLaunch(secondBrainIngest(relPath, content))
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
          <VaultGuard
            setup={setup}
            verb="ingest"
            onStart={() => {
              setup.start()
              close()
            }}
          />
        ) : (
          <>
            <ModeTabs activeMode={activeMode} onSelect={setActiveMode} />

            <div
              className="wb-brain-ingest-body"
              role="tabpanel"
              id={`wb-ingest-panel-${activeMode}`}
              aria-labelledby={`wb-ingest-tab-${activeMode}`}
            >
              <CaptureArea mode={activeMode} busy={working} onCapture={queue.add} />

              {phaseView && <EngineProgress view={phaseView} />}
              <AudioJobList jobs={queue.jobs} onRemove={queue.remove} />

              <TranscriptEditor mode={activeMode} content={content} onChange={setContent} />
            </div>

            {activeMode !== 'text' && (
              <ModelRow
                model={model}
                models={models}
                onSelect={setModel}
                onManage={() => setModelsOpen(true)}
              />
            )}

            <ModelManager
              open={modelsOpen}
              onOpenChange={(next) => {
                setModelsOpen(next)
                // Downloads/deletions in the manager change the picker's list.
                if (!next) void window.hive.whisper.listModels().then(setModels)
              }}
              variant={engineVariant}
            />

            {error && (
              <p className="wb-brain-ingest-error" role="alert">
                {error}
              </p>
            )}

            <div className="wb-brain-ingest-actions">
              {/* The reason lives beside the button, not in a tooltip: a
                  disabled control is not hoverable in every input model, and
                  "why can't I click this" should never need discovery. */}
              <p className="wb-brain-ingest-block" id="wb-ingest-block">
                {blockHint(block, activeMode)}
              </p>
              <div className="wb-brain-ingest-buttons">
                <Button cut={false} variant="ghost" className="wb-btn" onClick={close}>
                  {t('secondBrain.ingestCancel')}
                </Button>
                <Button
                  cut={false}
                  className="wb-btn wb-brain-ingest-confirm"
                  disabled={block !== null || busy}
                  aria-describedby="wb-ingest-block"
                  onClick={ingest}
                >
                  {busy ? t('secondBrain.ingestStaging') : t('secondBrain.ingestConfirm')}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
