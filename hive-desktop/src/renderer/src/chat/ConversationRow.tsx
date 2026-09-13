import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Checkbox } from '@hive/design-system'
import { relativeTimeLabel, t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { CheckIcon, CloseIcon, PencilIcon, TrashIcon } from '../ui/icons'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'

/** Per-row transient UI state: which row is being renamed / has its delete armed. */
export interface RowMode {
  id: string
  kind: 'rename' | 'confirm-delete'
}

export interface ConversationRowProps {
  meta: ChatSessionMeta
  active: boolean
  /** background-turns: this conversation's reply is still being generated. */
  running: boolean
  /** Agent Change Review: pending files this conversation's turns left to review (0 = none). */
  reviewPending: number
  mode: RowMode | null
  /** List-load timestamp — the render-stable "now" for relative times (react-hooks/purity). */
  now: number
  onOpen: (id: string) => void
  onModeChange: (mode: RowMode | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  /** This row is ticked for a bulk action. */
  selected?: boolean
  /**
   * The list has a selection, so every row's tick box is on screen.
   *
   * Without it the boxes would appear on hover only — which is right for
   * *starting* a selection (a permanent column of empty boxes over a list
   * people mostly just click to open is a lot of furniture for a rare task) and
   * wrong the moment one exists: the rows you have not ticked are exactly the
   * ones you are deciding about, and they would be the ones with nothing to
   * decide with.
   */
  selectionMode?: boolean
  /** Ticks or unticks this row. `range` is a Shift-click — extend from the last row touched. */
  onToggleSelect?: (id: string, opts: { range: boolean }) => void
}

/**
 * One conversation row. Three faces: the default open-button + hover actions,
 * an inline rename editor, and an inline delete confirmation — inline (not a
 * nested dialog) so the flow never stacks a modal on a popover.
 *
 * Extracted from the old history popover (nav-redesign) because the list now
 * has two homes: the sidebar's `Conversas` section and the wide "Todas as
 * conversas" surface. Both need the same row, with the same rename and the same
 * two-step delete — one component is what keeps them from drifting.
 */
export function ConversationRow({
  meta,
  active,
  running,
  reviewPending,
  mode,
  now,
  onOpen,
  onModeChange,
  onRename,
  onDelete,
  selected = false,
  selectionMode = false,
  onToggleSelect
}: ConversationRowProps): React.JSX.Element {
  const title = sessionTitle(meta)
  const [draft, setDraft] = useState(title)
  const openRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  useEffect(() => {
    if (wasEditing.current && mode === null) openRef.current?.focus()
    wasEditing.current = mode !== null
  }, [mode])

  const commitRename = (): void => {
    const next = draft.trim()
    onModeChange(null)
    if (next !== '' && next !== title) onRename(meta.id, next)
  }

  if (mode?.kind === 'rename') {
    return (
      <div className="wb-history-row" data-editing="true">
        <input
          className="wb-history-rename-input"
          value={draft}
          placeholder={t('chatHistory.renamePlaceholder')}
          aria-label={t('chatHistory.renamePlaceholder')}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitRename()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onModeChange(null)
            }
          }}
        />
        <div className="wb-history-actions" data-visible="true">
          <IconButton
            label={t('chatHistory.renameConfirmLabel')}
            className="wb-history-action"
            onClick={commitRename}
          >
            <CheckIcon size={13} />
          </IconButton>
          <IconButton
            label={t('chatHistory.renameCancelLabel')}
            className="wb-history-action"
            onClick={() => onModeChange(null)}
          >
            <CloseIcon size={13} />
          </IconButton>
        </div>
      </div>
    )
  }

  if (mode?.kind === 'confirm-delete') {
    return (
      <div className="wb-history-row" data-editing="true">
        <span className="wb-history-confirm-text">{t('chatHistory.deleteConfirmQuestion')}</span>
        <div className="wb-history-actions" data-visible="true">
          <button
            type="button"
            className="wb-history-confirm-btn"
            data-danger="true"
            autoFocus
            onClick={() => onDelete(meta.id)}
          >
            {t('chatHistory.deleteConfirmCta')}
          </button>
          <button
            type="button"
            className="wb-history-confirm-btn"
            onClick={() => onModeChange(null)}
          >
            {t('chatHistory.deleteCancelCta')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wb-history-row" {...rowState(active, selected, selectionMode)}>
      {onToggleSelect && (
        <RowTick id={meta.id} title={title} selected={selected} onToggle={onToggleSelect} />
      )}
      <button
        ref={openRef}
        type="button"
        className="wb-history-open"
        data-history-open="true"
        data-history-id={meta.id}
        aria-label={openName(title, reviewPending)}
        aria-current={active ? 'true' : undefined}
        onClick={(event) => {
          // Ctrl/Cmd-click is the second way to tick a row without going for
          // the box — the gesture every file manager already taught. Shift
          // extends from the last one touched, same as on the box itself.
          if (picksInstead(event, onToggleSelect)) {
            event.preventDefault()
            onToggleSelect?.(meta.id, { range: event.shiftKey })
            return
          }
          onOpen(meta.id)
        }}
      >
        <span className="wb-history-row-title">
          <span className="wb-history-row-name">{title}</span>
          {active && <span className="wb-history-current">{t('chatHistory.currentBadge')}</span>}
        </span>
        <span className="wb-history-row-meta">
          {/* Agent Change Review: this conversation is holding files nobody has
              decided on yet. It rides alongside the other faces instead of
              replacing them — the review card is scoped to its own transcript
              now, so this marker is the only thing pointing back to it. */}
          {reviewPending > 0 && (
            <span className="wb-history-review" data-review-pending={reviewPending}>
              <PencilIcon size={11} aria-hidden="true" />
              {t('chatHistory.reviewPending', reviewPending)}
            </span>
          )}
          {running ? (
            // background-turns: "still generating" beats time·count.
            <span className="wb-history-running">
              <span className="wb-history-running-dot" aria-hidden="true" />
              {t('chatHistory.runningLabel')}
            </span>
          ) : meta.match ? (
            // Full-text hit: the matched excerpt is worth more than time·count.
            <span className="wb-history-row-snippet">{meta.match}</span>
          ) : (
            <>
              <span>{relativeTimeLabel(meta.updatedAt, now)}</span>
              <span className="wb-history-row-dot" aria-hidden="true" />
              <span>{t('chatHistory.messageCount', meta.messageCount)}</span>
            </>
          )}
        </span>
      </button>
      <div className="wb-history-actions">
        <IconButton
          label={t('chatHistory.renameLabel', title)}
          className="wb-history-action"
          onClick={() => {
            setDraft(title)
            onModeChange({ id: meta.id, kind: 'rename' })
          }}
        >
          <PencilIcon size={13} />
        </IconButton>
        <IconButton
          label={t('chatHistory.deleteLabel', title)}
          className="wb-history-action"
          data-danger="true"
          onClick={() => onModeChange({ id: meta.id, kind: 'confirm-delete' })}
        >
          <TrashIcon size={13} />
        </IconButton>
      </div>
    </div>
  )
}

/**
 * The three facts the row's styling branches on, as data attributes.
 *
 * `|| undefined` rather than `false`, because `data-x="false"` is a *present*
 * attribute and `[data-x]` would match it. Written once here for the same
 * reason the pane header's helpers are at module scope: the row is at the
 * lint's branch ceiling, and this is spelling, not a decision.
 */
function rowState(
  active: boolean,
  selected: boolean,
  selectionMode: boolean
): Record<string, '' | undefined> {
  return {
    'data-active': active ? '' : undefined,
    'data-selected': selected ? '' : undefined,
    'data-selecting': selectionMode ? '' : undefined
  }
}

/**
 * The row's tick box.
 *
 * Everything — pointer and keyboard — goes through `onClick`, and the box is
 * fully controlled from above. Radix's own `onCheckedChange` hands back the
 * next state but not the *event*, and the event is where Shift lives; a
 * `<button role="checkbox">` fires click for Space too, so one handler covers
 * both gestures.
 */
function RowTick({
  id,
  title,
  selected,
  onToggle
}: {
  id: string
  title: string
  selected: boolean
  onToggle: (id: string, opts: { range: boolean }) => void
}): React.JSX.Element {
  return (
    <Checkbox
      className="wb-history-check"
      checked={selected}
      // The name says what the press will DO, and it names the conversation:
      // a column of boxes all called "Selecionar" is a list a screen-reader
      // user cannot navigate.
      aria-label={
        selected ? t('chatHistory.deselectLabel', title) : t('chatHistory.selectLabel', title)
      }
      onClick={(event: MouseEvent<HTMLButtonElement>) => onToggle(id, { range: event.shiftKey })}
    />
  )
}

/** Whether this click is a *pick* rather than an *open* — the file-manager modifiers. */
function picksInstead(
  event: MouseEvent<HTMLButtonElement>,
  onToggleSelect: ConversationRowProps['onToggleSelect']
): boolean {
  if (onToggleSelect === undefined) return false
  return event.metaKey || event.ctrlKey || event.shiftKey
}

/** The open button's accessible name — it folds in the review marker, which is otherwise colour-only. */
function openName(title: string, reviewPending: number): string {
  return reviewPending > 0
    ? t('chatHistory.openWithReviewAria', title, reviewPending)
    : t('chatHistory.openAria', title)
}
