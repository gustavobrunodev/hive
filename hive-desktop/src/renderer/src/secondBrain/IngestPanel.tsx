import { useCallback, useMemo, useRef, useState } from 'react'
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle } from '@hive/design-system'
import { t } from '../i18n'
import { MicIcon, PencilIcon, WaveformIcon } from '../ui/icons'
import type { RoleAction } from '../ui/ActionRail'
import { useComposerDictation } from '../dictation/useComposerDictation'
import type { DictationEngine } from '../dictation/useDictation'
import { e2eDictationEngine } from '../dictation/e2eDictationSeam'
import type { IngestMode } from './SecondBrainFab'
import type { BrainSetup } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import { VaultGuard } from './VaultGuard'
import { secondBrainIngest } from './secondBrainPrompts'
import { AudioJobList } from './whisper/AudioJobList'
import { AudioStage } from './whisper/AudioStage'
import { EngineProgress } from './whisper/EngineProgress'
import { LiveConsole } from './whisper/LiveConsole'
import { ModelCaption, ModelPicker } from './whisper/ModelPicker'
import { TranscriptDocument } from './whisper/TranscriptDocument'
import { useAudioIngest } from './whisper/useAudioIngest'
import { enginePhaseView } from './whisper/enginePhase'
import { ModelManager } from './whisper/ModelManager'
import { useWhisperCatalog } from './whisper/useWhisperCatalog'
import { useWhisperPreference } from './whisper/useWhisperPreference'
import {
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL,
  useWhisper,
  type WhisperModelId
} from './whisper/useWhisper'

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
  labelKey: 'sourceWrite' | 'sourceAudio' | 'sourceLive'
  Icon: typeof PencilIcon
}> = [
  { mode: 'text', labelKey: 'sourceWrite', Icon: PencilIcon },
  { mode: 'audioFile', labelKey: 'sourceAudio', Icon: WaveformIcon },
  { mode: 'record', labelKey: 'sourceLive', Icon: MicIcon }
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
  if (mode === 'text') return t('secondBrain.ingestBlockedEmptyText')
  return mode === 'audioFile'
    ? t('secondBrain.ingestBlockedEmptyAudio')
    : t('secondBrain.ingestBlockedEmptyLive')
}

/** Which document captions the active source calls for. */
function documentSource(mode: IngestMode): 'text' | 'audio' | 'live' {
  if (mode === 'text') return 'text'
  return mode === 'audioFile' ? 'audio' : 'live'
}

/** The three sources, as tabs. */
function SourceTabs({
  activeMode,
  onSelect,
  locked
}: {
  activeMode: IngestMode
  onSelect: (mode: IngestMode) => void
  /** True while a take or a batch is running — switching now would strand it. */
  locked: boolean
}): React.JSX.Element {
  return (
    <div className="wb-source-tabs" role="tablist" aria-label={t('secondBrain.sourceGroupLabel')}>
      {TABS.map(({ mode, labelKey, Icon }) => (
        <button
          key={mode}
          type="button"
          role="tab"
          id={`wb-ingest-tab-${mode}`}
          aria-selected={activeMode === mode}
          aria-controls={`wb-ingest-panel-${mode}`}
          className="wb-source-tab"
          data-active={activeMode === mode || undefined}
          disabled={locked && activeMode !== mode}
          onClick={() => onSelect(mode)}
        >
          <Icon size={15} aria-hidden="true" />
          {t(`secondBrain.${labelKey}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * The capture surface for the active source.
 *
 * Typed text has none — the document below *is* the whole interface there —
 * while the two audio sources are deliberately different shapes rather than one
 * generalized "capture" widget: uploading is a batch you assemble and then run,
 * dictating is a live take you watch. Pretending they are the same control was
 * what made the old recorder feel like a file picker with a microphone in it.
 */
function CaptureStage({
  mode,
  queue,
  phaseView,
  dictation
}: {
  mode: IngestMode
  queue: ReturnType<typeof useAudioIngest>
  phaseView: ReturnType<typeof enginePhaseView>
  dictation: ReturnType<typeof useComposerDictation>
}): React.JSX.Element | null {
  if (mode === 'audioFile') {
    return (
      <>
        <AudioStage
          busy={queue.busy}
          onTranscribe={(files) =>
            queue.add(files.map((file) => ({ blob: file, name: file.name })))
          }
        />
        {phaseView && <EngineProgress view={phaseView} />}
        <AudioJobList jobs={queue.jobs} onRemove={queue.remove} />
      </>
    )
  }
  if (mode === 'record') {
    return (
      <LiveConsole
        phase={dictation.phase}
        levels={dictation.levels}
        failure={dictation.failure}
        onStart={dictation.start}
        onFinish={dictation.finish}
        onDiscard={dictation.discard}
        onRetry={dictation.retry}
        onPrewarm={dictation.prewarm}
        disabled={queue.busy}
      />
    )
  }
  return null
}

/**
 * The model strip, its caption, and the catalog behind it.
 *
 * Only where audio is involved: typed text needs no transcription model, and a
 * control that has no effect on the current source is noise (SB-R4.4).
 */
function ModelRow({
  mode,
  preference,
  catalog,
  model,
  onSelect,
  onAuto,
  managerOpen,
  setManagerOpen
}: {
  mode: IngestMode
  preference: ReturnType<typeof useWhisperPreference>['preference']
  catalog: ReturnType<typeof useWhisperCatalog>
  model: WhisperModelId
  onSelect: (id: WhisperModelId) => void
  onAuto: () => void
  managerOpen: boolean
  setManagerOpen: (open: boolean) => void
}): React.JSX.Element {
  return (
    <>
      {mode !== 'text' && (
        <div className="wb-model-row">
          <ModelPicker
            preference={preference}
            models={catalog.models}
            onSelect={onSelect}
            onAuto={onAuto}
            onOpenCatalog={() => setManagerOpen(true)}
          />
          <ModelCaption preference={preference} models={catalog.models} />
        </div>
      )}

      <ModelManager
        open={managerOpen}
        onOpenChange={(next) => {
          setManagerOpen(next)
          // Downloads/deletions in the manager change the picker's list.
          if (!next) catalog.refresh()
        }}
        variant={catalog.variant}
        selectedId={model}
        onSelect={onSelect}
      />
    </>
  )
}

/**
 * The send bar. The reason a send is blocked sits on the same line as the
 * button that is blocked — a disabled control is not hoverable in every input
 * model, and "why can't I click this" should never need discovery.
 */
function Footer({
  block,
  mode,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  block: IngestBlock
  mode: IngestMode
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <>
      {error !== null && (
        <p className="wb-brain-ingest-error" role="alert">
          {error}
        </p>
      )}

      <div className="wb-brain-ingest-actions">
        <p className="wb-brain-ingest-block" id="wb-ingest-block">
          {blockHint(block, mode)}
        </p>
        <div className="wb-brain-ingest-buttons">
          <Button cut={false} variant="ghost" className="wb-btn" onClick={onCancel}>
            {t('secondBrain.ingestCancel')}
          </Button>
          <Button
            cut={false}
            className="wb-btn wb-brain-ingest-confirm"
            disabled={block !== null || busy}
            aria-describedby="wb-ingest-block"
            onClick={onConfirm}
          >
            {busy ? t('secondBrain.ingestStaging') : t('secondBrain.ingestConfirm')}
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * The ingestion sheet (SB-R3.2–3.4, SB-R4.7, SB-R5.6) — three ways to fill
 * **one** document, and one **Ingerir** that sends it: write the content to the
 * vault's `raw/` inbox, then launch `/second-brain-ingest` with that text so the
 * transcript shows what was actually sent and the agent files it into the wiki
 * (D-SB-5).
 *
 * The two things that changed the shape of this screen:
 *
 * - **A transcript is a draft, not a result.** Every audio path now lands in an
 *   editable field that is on screen the whole time, because a local model's
 *   output always wants a human pass and the moment to make it is before the
 *   text leaves for the wiki — not after, in a file the agent already filed.
 * - **Speaking and transcribing happen at once.** "Ditar ao vivo" replaced a
 *   record-then-wait recorder: phrases are cut on silence and transcribed while
 *   the next one is being spoken, so the words appear as they are said and the
 *   correction pass starts before the take is even over.
 *
 * Guards: with no vault the sheet offers "Configurar base" instead of writing to
 * a missing path (SB-R3.3), and **Ingerir** stays blocked — with the reason
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
  const [modelsOpen, setModelsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  // Catalog + download precision, loaded only while the sheet is open. Keyed on
  // the engine phase so a model fetched mid-session shows up without a reopen.
  const catalog = useWhisperCatalog(open, whisper.phase.status)

  // Which model transcription runs with, resolved in main from the hardware
  // probe unless the user pinned one (SB-R7.4). `DEFAULT_MODEL` covers only the
  // round trip before main answers — an audio pass cannot start that fast.
  const { preference, select, reset } = useWhisperPreference(open)
  const model: WhisperModelId = preference?.id ?? DEFAULT_MODEL

  // Every finished transcript is appended under a heading naming its source.
  // Two voice memos and a meeting recording become one reviewable document,
  // and the wiki page the agent writes keeps the attribution.
  const appendTranscript = useCallback((text: string, name: string) => {
    if (text.trim() === '') return
    setContent((current) =>
      current.trim() === '' ? text : `${current.trim()}\n\n## ${name}\n\n${text}`
    )
  }, [])

  // One audio→transcript queue for the file stage (SB-R4.5): decode, transcribe,
  // append — one file at a time, each with its own visible state.
  const queue = useAudioIngest(whisper, model, appendTranscript)

  // Live dictation reuses M13's engine and hook wholesale (VP-R5.1): the hook
  // never imported from `chat/`, so pointing it at this field is wiring rather
  // than a second implementation of segmenting, queueing and joining.
  // Depends on the engine's *stable* pieces, not on the object `useWhisper`
  // rebuilds every render — otherwise the memo recomputes on every keystroke in
  // the transcript, which is the one thing this surface does constantly.
  const { phase: whisperPhase, transcribe: whisperTranscribe } = whisper
  const dictationEngine = useMemo<DictationEngine>(
    () =>
      // A real Whisper pass would add a model load to every E2E run; the seam
      // returns null in every other context.
      e2eDictationEngine() ?? {
        phase: whisperPhase,
        transcribe: (pcm) => whisperTranscribe(pcm, { model, language: DEFAULT_LANGUAGE })
      },
    [whisperPhase, whisperTranscribe, model]
  )
  const dictation = useComposerDictation({
    value: content,
    setValue: setContent,
    textareaRef,
    engine: dictationEngine
  })

  const engineBusy = whisper.phase.status !== 'idle' && whisper.phase.status !== 'error'
  const working = engineBusy || queue.busy || dictation.active
  const phaseView = enginePhaseView(whisper.phase)

  const close = useCallback(() => {
    // A sheet dismissed mid-take must not leave the microphone open.
    if (dictation.active) dictation.discard()
    setContent('')
    setError(null)
    onClose()
  }, [dictation, onClose])

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
            <SourceTabs
              activeMode={activeMode}
              onSelect={setActiveMode}
              locked={queue.busy || dictation.active}
            />

            <div
              className="wb-brain-ingest-body"
              role="tabpanel"
              id={`wb-ingest-panel-${activeMode}`}
              aria-labelledby={`wb-ingest-tab-${activeMode}`}
            >
              <CaptureStage
                mode={activeMode}
                queue={queue}
                phaseView={phaseView}
                dictation={dictation}
              />

              <TranscriptDocument
                ref={textareaRef}
                value={content}
                onChange={setContent}
                onKeyDown={dictation.handleKeyDown}
                freshRange={dictation.freshRange}
                live={dictation.active}
                source={documentSource(activeMode)}
              />
            </div>

            <ModelRow
              mode={activeMode}
              preference={preference}
              catalog={catalog}
              model={model}
              onSelect={select}
              onAuto={reset}
              managerOpen={modelsOpen}
              setManagerOpen={setModelsOpen}
            />

            <Footer
              block={block}
              mode={activeMode}
              busy={busy}
              error={error}
              onCancel={close}
              onConfirm={ingest}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
