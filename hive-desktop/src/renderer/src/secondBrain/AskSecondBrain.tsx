import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Textarea
} from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import { BrainIcon, HistoryIcon } from '../ui/icons'
import { loadRecentQuestions, rememberQuestion } from './askHistory'
import { secondBrainQuery, SECOND_BRAIN_SETUP } from './secondBrainPrompts'
import type { SecondBrainStore } from './useSecondBrain'

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
  /** Launches a slash command through the chat (D-SB-5) — where the answer lands. */
  onLaunch: (action: RoleAction) => void
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

/** The "set the base up first" guard, mirroring the ingestion sheet's (SB-R3.3). */
function AskGuard({ onSetup }: { onSetup: () => void }): React.JSX.Element {
  return (
    <div className="wb-brain-ask-guard">
      <p className="wb-brain-ask-guard-title">{t('secondBrain.ingestNoVaultTitle')}</p>
      <p className="wb-brain-ask-guard-desc">{t('secondBrain.askNoVaultDescription')}</p>
      <Button cut={false} className="wb-btn hds-btn-primary" onClick={onSetup}>
        {t('secondBrain.emptyCta')}
      </Button>
    </div>
  )
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
  onLaunch
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

  const ask = useCallback(() => {
    const asked = question.trim()
    if (asked === '') return
    onLaunch(secondBrainQuery(asked))
    setRecents(rememberQuestion(store.workspace, asked))
    setQuestion('')
    onOpenChange(false)
  }, [question, store.workspace, onLaunch, onOpenChange])

  const setup = useCallback(() => {
    onLaunch(SECOND_BRAIN_SETUP)
    onOpenChange(false)
  }, [onLaunch, onOpenChange])

  const empty = question.trim() === ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="wb-brain-ask-dialog"
        // Radix focuses the panel by default; the field is the whole point.
        onOpenAutoFocus={(event: Event) => {
          event.preventDefault()
          fieldRef.current?.focus()
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
          <AskGuard onSetup={setup} />
        ) : (
          <>
            <Textarea
              ref={fieldRef}
              className="wb-brain-ask-field"
              minRows={2}
              maxRows={7}
              value={question}
              placeholder={t('secondBrain.askPlaceholder')}
              aria-label={t('secondBrain.askFieldLabel')}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setQuestion(event.target.value)
              }
              onSubmit={ask}
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

            <footer className="wb-brain-ask-foot">
              <span className="wb-brain-ask-hint">{t('secondBrain.askSubmitHint')}</span>
              <Button cut={false} className="wb-btn hds-btn-primary" disabled={empty} onClick={ask}>
                {t('secondBrain.askSubmit')}
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
