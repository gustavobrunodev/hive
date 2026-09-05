import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  HighlightedTextarea
} from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import { BrainIcon, HistoryIcon, MicIcon } from '../ui/icons'
import { DictationBar } from '../dictation/DictationBar'
import { useAsrDictation, type AsrDictation } from '../dictation/useAsrDictation'
import type { ComposerDictation } from '../dictation/useComposerDictation'
import { VoiceModelGate } from '../voice/VoiceModelGate'
import { RunConfigBar } from '../ui/RunConfigBar'
import { useRunConfig, type RunLaunchOpts } from '../chat/useRunConfig'
import { loadRecentQuestions, rememberQuestion } from './askHistory'
import { secondBrainQuery } from './secondBrainPrompts'
import type { BrainSetup } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import { VaultGuard } from './VaultGuard'
import { transcriptRuns } from './audio/transcriptBackdrop'

/**
 * Question openers shown to someone facing an empty field (SB-R9.3). They
 * teach what a knowledge base is good at — decisions, mechanics, ownership,
 * synthesis — rather than decorating the surface. Each label ends in an
 * ellipsis; inserting it drops the ellipsis and leaves the caret after a
 * trailing space, so the user continues their own sentence.
 */
const STARTER_KEYS = [
  'askStarterDecision',
  'askStarterHow',
  'askStarterOwner',
  'askStarterSummary'
] as const

/** `'O que decidimos sobre…'` → `'O que decidimos sobre '` (the typed stem). */
function starterStem(label: string): string {
  return `${label.replace(/…$/, '').trimEnd()} `
}

interface AskSecondBrainProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vault status for the active workspace (drives the no-vault guard + the pending caveat). */
  store: SecondBrainStore
  /**
   * Launches a slash command through the chat (D-SB-5) — where the answer
   * lands — on the agent/model chosen in the footer's run-config.
   */
  onLaunch: (action: RoleAction, opts?: RunLaunchOpts) => void
  /** multi-agent: enabled agent ids, in display order — who can answer. */
  agents?: string[]
  /** The app default, where the run-config starts. */
  defaultAgent?: string | null
  /** The vault-setup flow — drives the no-vault guard's two states. */
  setup: BrainSetup
  /** Opens Perfil › Voz e transcrição, for the model gate's way out (M26). */
  onOpenVoiceSettings?: () => void
}

/**
 * The footer's leading half: the microphone, and the transport it becomes.
 *
 * Deliberately the chat composer's shape rather than the ingestion sheet's
 * console (VP-R1.1/R1.3) — a quiet control beside the field, handing the row
 * over to `DictationBar` while a take is live. Dictating a question and
 * dictating a message are the same gesture, and a second dialect of it here
 * would be one more thing to learn for nothing.
 */
function AskDictation({ voice }: { voice: AsrDictation }): React.JSX.Element {
  const { dictation, voiceGate } = voice
  if (dictation.active) {
    return (
      <DictationBar
        phase={dictation.phase}
        levels={dictation.levels}
        failure={dictation.failure}
        partial={dictation.partial}
        onFinish={dictation.finish}
        onDiscard={dictation.discard}
        onRetry={dictation.retry}
        onRequestMic={dictation.start}
      />
    )
  }
  return (
    <span className="wb-brain-ask-foot-lead">
      <button
        type="button"
        className="wb-attach-btn wb-mic-btn"
        aria-label={t('dictation.start')}
        title={t('dictation.startHint')}
        // Warming a model that is not there would be a download nobody asked
        // for, so hovering only preheats once one exists.
        onPointerEnter={voiceGate.blocked ? undefined : dictation.prewarm}
        onFocus={voiceGate.blocked ? undefined : dictation.prewarm}
        onClick={() => voiceGate.guard(dictation.start)}
      >
        <MicIcon size={15} />
      </button>
      <span className="wb-brain-ask-hint">{t('secondBrain.askSubmitHint')}</span>
    </span>
  )
}

/** The four openers, as a chip row that fills the field instead of submitting. */
function AskStarters({ onPick }: { onPick: (text: string) => void }): React.JSX.Element {
  return (
    <div className="wb-brain-ask-block">
      <p className="wb-brain-ask-block-title">{t('secondBrain.askStartersTitle')}</p>
      <div className="wb-brain-ask-chips">
        {STARTER_KEYS.map((key) => {
          const label = t(`secondBrain.${key}`)
          return (
            <button
              key={key}
              type="button"
              className="wb-brain-ask-chip"
              onClick={() => onPick(starterStem(label))}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Previously asked questions (SB-R9.4). Picking one *fills* the field rather
 * than firing immediately — re-asking is usually re-phrasing, and a click that
 * silently starts an agent turn is the kind of surprise this app avoids.
 */
function AskRecents({
  questions,
  onPick
}: {
  questions: string[]
  onPick: (text: string) => void
}): React.JSX.Element {
  return (
    <div className="wb-brain-ask-block">
      <p className="wb-brain-ask-block-title">{t('secondBrain.askRecentTitle')}</p>
      <ul className="wb-brain-ask-recents">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              className="wb-brain-ask-recent"
              aria-label={t('secondBrain.askUseRecent', question)}
              onClick={() => onPick(question)}
            >
              <HistoryIcon size={13} className="wb-brain-ask-recent-icon" />
              <span className="wb-brain-ask-recent-text">{question}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * VP-R1.6, applied to a question: asking *during* a take finalizes it first and
 * sends what the transcription actually produced — never half a question.
 *
 * The ask is deferred until the queue drains, and a take that ended in an error
 * does not send at all: the failure and its retry are on screen, and asking the
 * base a question missing a phrase is exactly the silent loss the whole feature
 * exists to prevent.
 */
function useAskAfterDictation(dictation: ComposerDictation, ask: () => void): () => void {
  const pending = useRef(false)
  const status = dictation.phase.status

  useEffect(() => {
    if (!pending.current) return
    if (status === 'finalizing') return
    pending.current = false
    if (status !== 'idle') return
    // Named-and-invoked (the `useVoiceGate` pattern): the send is a reaction to
    // the queue draining, not a bare state write in an effect body.
    function send(): void {
      ask()
    }
    send()
  }, [ask, status])

  const { active, finish } = dictation
  return useCallback(() => {
    if (active) {
      pending.current = true
      finish()
      return
    }
    ask()
  }, [active, ask, finish])
}

/**
 * **Perguntar à base** (SB-R9) — ask the Second Brain anything, from anywhere:
 * `Ctrl+Shift+K`, the sidebar's primary action, or the floating button's menu.
 *
 * One field, one verb. The question rides inside the slash command
 * (`/second-brain-query <pergunta>`, `secondBrainQuery`) so the transcript
 * shows what was actually asked, and the agent's synthesis renders in the chat
 * — this surface never tries to be a second answer viewport (the spec's
 * explicit non-goal), it just says plainly where the answer will appear.
 *
 * What makes it worth opening twice: it remembers the workspace's recent
 * questions, teaches openers while there are none, and admits when staged
 * material hasn't reached the wiki yet — a caveat the agent's answer can't know
 * to give.
 */
export function AskSecondBrain({
  open,
  onOpenChange,
  store,
  onLaunch,
  setup,
  onOpenVoiceSettings,
  agents = [],
  defaultAgent = null
}: AskSecondBrainProps): React.JSX.Element {
  const [question, setQuestion] = useState('')
  const [recents, setRecents] = useState<string[]>([])
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  // Set by the fill-the-field actions; consumed once the new value is committed
  // so the caret lands after the inserted text instead of before it.
  const caretPending = useRef(false)

  // Recents are per workspace and change while the dialog is closed (asking
  // from the FAB, switching workspaces) — re-read on every open. Derived during
  // render rather than in an effect (the IngestPanel `lastMode` pattern): a
  // synchronous `localStorage` read has no external system to synchronize with,
  // and an effect would cost an extra render pass on every open.
  const openFor = open ? store.workspace : null
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (openFor !== loadedFor) {
    setLoadedFor(openFor)
    if (openFor !== null) setRecents(loadRecentQuestions(openFor))
  }

  useEffect(() => {
    if (!caretPending.current) return
    caretPending.current = false
    const field = fieldRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [question])

  const fill = useCallback((text: string) => {
    caretPending.current = true
    setQuestion(text)
  }, [])

  // Who answers, on which model and at what effort. A synthesis over the whole
  // wiki is exactly the question where the choice matters — and where reading
  // the transcript afterwards to find out which agent wrote it is too late.
  const runConfig = useRunConfig({
    agents,
    defaultAgent,
    workspace: store.workspace,
    active: open
  })

  const ask = useCallback(() => {
    const asked = question.trim()
    if (asked === '') return
    onLaunch(secondBrainQuery(asked), runConfig.launchOpts)
    setRecents(rememberQuestion(store.workspace, asked))
    setQuestion('')
    onOpenChange(false)
  }, [question, store.workspace, onLaunch, onOpenChange, runConfig.launchOpts])

  // A question can be spoken instead of typed, with the composer's own
  // machinery: the field is the target, the engine is the app's own, and
  // the installed-model gate stands in front of both. `active: open` keeps a
  // closed dialog off the model preference's subscription.
  const voice = useAsrDictation({
    value: question,
    setValue: setQuestion,
    textareaRef: fieldRef,
    active: open
  })
  const { dictation } = voice

  const askOrFinish = useAskAfterDictation(dictation, ask)

  // A dialog dismissed mid-take must not leave the OS microphone lit (VP-R4.6),
  // and the words already transcribed leave with the question being abandoned.
  const changeOpen = useCallback(
    (next: boolean) => {
      if (!next && dictation.active) dictation.discard()
      onOpenChange(next)
    },
    [dictation, onOpenChange]
  )

  const startSetup = useCallback(() => {
    setup.start()
    onOpenChange(false)
  }, [setup, onOpenChange])

  const empty = question.trim() === ''

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="wb-brain-ask-dialog"
        // Radix focuses the panel by default; the field is the whole point.
        onOpenAutoFocus={(event: Event) => {
          event.preventDefault()
          fieldRef.current?.focus()
        }}
        // While a take is live, Esc belongs to the take: it discards and rewinds
        // the draft (VP-R1.5) instead of closing the surface being spoken into.
        onEscapeKeyDown={(event: KeyboardEvent) => {
          if (!dictation.active) return
          event.preventDefault()
          dictation.discard()
        }}
      >
        <header className="wb-brain-ask-head">
          <span className="wb-brain-ask-glyph" aria-hidden="true">
            <BrainIcon size={18} />
          </span>
          <div className="wb-brain-ask-heading">
            <DialogTitle className="wb-brain-ask-title">{t('secondBrain.ask')}</DialogTitle>
            <DialogDescription className="wb-brain-ask-desc">
              {t('secondBrain.askDescription')}
            </DialogDescription>
          </div>
          {store.vaultName !== null && (
            <span className="wb-brain-ask-vault">{store.vaultName}</span>
          )}
        </header>

        {!store.hasVault ? (
          <VaultGuard setup={setup} verb="ask" onStart={startSetup} />
        ) : (
          <>
            {/* A mirror behind the glyphs, so a phrase that just arrived from
                the microphone is visibly *what arrived* rather than something
                the user has to diff against their memory of the field
                (VP-R2.3). Same mechanism the transcript document uses. */}
            <HighlightedTextarea
              ref={fieldRef}
              className="wb-brain-ask-field"
              minRows={2}
              maxRows={7}
              value={question}
              active={dictation.active}
              placeholder={t('secondBrain.askPlaceholder')}
              aria-label={t('secondBrain.askFieldLabel')}
              onKeyDown={dictation.handleKeyDown}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setQuestion(event.target.value)
              }
              onSubmit={askOrFinish}
              highlight={(current: string) =>
                transcriptRuns(current, dictation.freshRange, dictation.previewRange).map(
                  (run, index) => (
                    <span
                      key={index}
                      className={
                        [
                          run.fresh ? 'wb-composer-fresh' : null,
                          run.preview ? 'wb-composer-preview' : null
                        ]
                          .filter((name) => name !== null)
                          .join(' ') || undefined
                      }
                    >
                      {run.text}
                    </span>
                  )
                )
              }
            />

            {store.rawPending > 0 && (
              <p className="wb-brain-ask-note">
                {t('secondBrain.askPendingNote', store.rawPending)}
              </p>
            )}

            {/* Memory beats teaching once there is any: a returning user gets
                their own questions back, a first-timer gets the openers. */}
            {recents.length > 0 ? (
              <AskRecents questions={recents} onPick={fill} />
            ) : (
              empty && <AskStarters onPick={fill} />
            )}

            {/* The run-config sits on its own line above the send row rather
                than inside it: while a take is live the transport takes that
                row over entirely (the composer's rule), and a control that
                disappears mid-question would look like it had been lost. */}
            <RunConfigBar config={runConfig} legend={t('runConfig.askLegend')} variant="inline" />

            <footer className="wb-brain-ask-foot">
              <AskDictation voice={voice} />
              <Button
                cut={false}
                className="wb-btn hds-btn-primary"
                disabled={empty}
                onClick={askOrFinish}
              >
                {t('secondBrain.askSubmit')}
              </Button>
            </footer>
          </>
        )}
        {/* Nested inside the dialog on purpose (the ingestion sheet's rule):
            the question already typed here has to survive the detour, and
            closing this to fetch a model would throw it away. */}
        <VoiceModelGate
          open={voice.voiceGate.open}
          onOpenChange={voice.voiceGate.setOpen}
          onOpenSettings={() => onOpenVoiceSettings?.()}
        />
      </DialogContent>
    </Dialog>
  )
}
