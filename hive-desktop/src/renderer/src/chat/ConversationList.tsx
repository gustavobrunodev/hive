import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Empty, SelectionBar, Skeleton } from '@hive/design-system'
import { t } from '../i18n'
import { ChatBubbleIcon, TrashIcon } from '../ui/icons'
import { ConversationRow, type RowMode } from './ConversationRow'
import { extend, setAll, toggle, visible } from './conversationSelection'
import type { ChatSessionMeta } from './sessionMeta'
import {
  groupTimestamp,
  groupsFor,
  windowLabel,
  type ActivityWindow,
  type ConversationSort
} from './conversationFilters'
import type { ChatSessionsStatus, ChatSessionsStore } from './useChatSessions'

type GroupKey = 'today' | 'yesterday' | 'week' | 'month' | 'older'

const GROUP_ORDER: readonly GroupKey[] = ['today', 'yesterday', 'week', 'month', 'older']

const GROUP_LABEL_KEY = {
  today: 'chatHistory.groupToday',
  yesterday: 'chatHistory.groupYesterday',
  week: 'chatHistory.groupWeek',
  month: 'chatHistory.groupMonth',
  older: 'chatHistory.groupOlder'
} as const

/** Recency buckets, cut on calendar-day boundaries (an 11pm chat is "Ontem" at 1am, exactly like every reference app). */
function groupKeyOf(updatedAt: number, now: number): GroupKey {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const today = startOfToday.getTime()
  const day = 86_400_000
  if (updatedAt >= today) return 'today'
  if (updatedAt >= today - day) return 'yesterday'
  if (updatedAt >= today - 6 * day) return 'week'
  if (updatedAt >= today - 29 * day) return 'month'
  return 'older'
}

export interface ConversationListProps {
  /** The rows to show — already filtered and ordered by the caller. */
  entries: readonly ChatSessionMeta[]
  /** How many conversations exist before the window/query narrowed them. */
  totalLoaded: number
  status: ChatSessionsStatus
  error?: ChatSessionsStore['error']
  /** A dialog controls editing so Escape dismisses the editor before the dialog. */
  rowMode?: RowMode | null
  onRowModeChange?: (mode: RowMode | null) => void
  /** Render-stable "now" (the load timestamp) for relative times and buckets. */
  now: number
  sort: ConversationSort
  window: ActivityWindow
  /** The live search text, so "nothing matched" can quote it. */
  query?: string
  activeSessionId: string | null
  runningSessionIds?: readonly string[]
  reviewPendingBySession?: Readonly<Record<string, number>>
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  /**
   * Deletes a whole selection at once.
   *
   * Separate from `onDelete` rather than a loop over it: the store answers one
   * write at a time, and N calls would repaint the list N times, each one
   * re-ordering the rows under the user's cursor mid-delete. Omitted on a
   * surface that should not offer multi-select at all — the rows then render
   * without tick boxes.
   */
  onDeleteMany?: (ids: string[]) => void
  onRetry: () => void
  /** Widens the window to "Todos" from inside the "nothing in this window" state. */
  onClearWindow: () => void
  /** How many skeleton rows the loading state draws (the sidebar has less room than the dialog). */
  skeletonRows?: number
}

/**
 * The conversation list and every state it can be in: loading, error, empty,
 * nothing-in-this-window, nothing-matched, and rows.
 *
 * All six are here rather than at the call sites because they are the same six
 * on both surfaces, and because they are easy to get subtly wrong in ways only
 * one of them would show — "no conversations at all" and "none in the last day"
 * look identical if you write them once and reuse the copy.
 *
 * Rows are grouped by recency only when the order is a recency order
 * (`groupsFor`): "Hoje" over an alphabetical list is a heading that lies about
 * why the rows are adjacent.
 */
export function ConversationList(props: ConversationListProps): React.JSX.Element {
  const errorKey = {
    rename: 'chatHistory.renameError',
    delete: 'chatHistory.deleteError',
    search: 'chatHistory.searchError'
  } as const
  return (
    <>
      {props.error && (
        <p className="wb-history-nomatch" role="alert">
          {t(errorKey[props.error])}
        </p>
      )}
      <ConversationListBody {...props} />
    </>
  )
}

function ConversationListBody({
  entries,
  totalLoaded,
  status,
  rowMode: controlledMode,
  onRowModeChange,
  now,
  sort,
  window: activityWindow,
  query = '',
  activeSessionId,
  runningSessionIds = [],
  reviewPendingBySession = {},
  onOpen,
  onRename,
  onDelete,
  onDeleteMany,
  onRetry,
  onClearWindow,
  skeletonRows = 3
}: ConversationListProps): React.JSX.Element {
  const [localMode, setLocalMode] = useState<RowMode | null>(null)
  const rowMode = controlledMode === undefined ? localMode : controlledMode
  const setRowMode = onRowModeChange ?? setLocalMode
  const listRef = useRef<HTMLDivElement>(null)
  const selection = useSelection(entries, onDeleteMany)

  /** ArrowUp/ArrowDown/Home/End move focus across the visible conversation rows. */
  const handleListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape' && rowMode !== null) {
        event.preventDefault()
        event.stopPropagation()
        setRowMode(null)
        return
      }
      // Escape walks *out*, one layer per press: the row editor first (above),
      // then the selection, and only then whatever surface contains the list.
      if (event.key === 'Escape' && selection.count > 0) {
        event.preventDefault()
        event.stopPropagation()
        selection.clear()
        return
      }
      // Space on a focused row ticks it — the keyboard's half of the gesture
      // the tick box gives the pointer. `preventDefault` is what keeps it from
      // also *opening* the conversation: the row is a `<button>`, and a button
      // activates on Space's key-UP unless the key-down is cancelled.
      const ticking = selection.enabled ? rowIdUnderSpace(event) : null
      if (ticking !== null) {
        event.preventDefault()
        selection.pick(ticking, { range: event.shiftKey })
        return
      }
      const rows = rowsToRove(event, listRef.current)
      if (rows === null) return
      event.preventDefault()
      rows[nextRowIndex(event.key, rows, document.activeElement)]?.focus()
    },
    [rowMode, setRowMode, selection]
  )

  const handleDelete = useCallback(
    (id: string): void => {
      setRowMode(null)
      onDelete(id)
    },
    [onDelete, setRowMode]
  )

  if (status === 'loading') {
    return (
      <div
        className="wb-history-loading"
        role="status"
        aria-busy="true"
        aria-label={t('chatHistory.loadingLabel')}
      >
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="wb-history-skeleton">
            <Skeleton style={{ width: `${72 - (index % 3) * 14}%`, height: 13 }} />
            <Skeleton style={{ width: 88, height: 10 }} />
          </div>
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="wb-history-error" role="alert">
        <p className="wb-history-error-title">{t('chatHistory.errorTitle')}</p>
        <p className="wb-history-error-body">{t('chatHistory.errorDescription')}</p>
        <button type="button" className="wb-history-error-retry" onClick={onRetry}>
          {t('chatHistory.retryCta')}
        </button>
      </div>
    )
  }

  if (totalLoaded === 0) {
    return (
      <Empty
        className="wb-history-empty"
        icon={<ChatBubbleIcon size={22} />}
        title={t('chatHistory.emptyTitle')}
        description={t('chatHistory.emptyDescription')}
      />
    )
  }

  if (entries.length === 0) {
    // Two different nothings. A query that matched nothing is the user's own
    // words coming back empty; a window that admits nothing is a control they
    // set and can undo, so that one ships the undo.
    if (query.trim() !== '') {
      return <p className="wb-history-nomatch">{t('chatHistory.noMatch', query.trim())}</p>
    }
    return (
      <div className="wb-history-nomatch">
        <p>{t('chatHistory.windowEmpty', windowLabel(activityWindow))}</p>
        <button type="button" className="wb-history-window-reset" onClick={onClearWindow}>
          {t('chatHistory.windowEmptyCta')}
        </button>
      </div>
    )
  }

  const rowFor = (meta: ChatSessionMeta): React.JSX.Element => (
    <ConversationRow
      meta={meta}
      active={meta.id === activeSessionId}
      running={runningSessionIds.includes(meta.id)}
      reviewPending={reviewPendingBySession[meta.id] ?? 0}
      mode={rowMode?.id === meta.id ? rowMode : null}
      now={now}
      onOpen={onOpen}
      onModeChange={setRowMode}
      onRename={onRename}
      onDelete={handleDelete}
      selected={selection.has(meta.id)}
      selectionMode={selection.count > 0}
      {...(selection.enabled ? { onToggleSelect: selection.pick } : {})}
    />
  )

  // Cut on the timestamp the list is *sorted* by, so a heading never contradicts
  // the order the control says is in force (see `groupTimestamp`).
  const groups = groupsFor(sort)
    ? GROUP_ORDER.map((key) => ({
        key,
        entries: entries.filter((meta) => groupKeyOf(groupTimestamp(meta, sort), now) === key)
      })).filter((group) => group.entries.length > 0)
    : null

  return (
    <div
      ref={listRef}
      className="wb-history-list"
      role="presentation"
      onKeyDown={handleListKeyDown}
    >
      {selection.count > 0 && <SelectionToolbar selection={selection} total={entries.length} />}
      {groups === null ? (
        <ul className="wb-history-group-list">
          {entries.map((meta) => (
            <li key={meta.id}>{rowFor(meta)}</li>
          ))}
        </ul>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="wb-history-group">
            <h3 className="wb-history-group-label">{t(GROUP_LABEL_KEY[group.key])}</h3>
            <ul className="wb-history-group-list">
              {group.entries.map((meta) => (
                <li key={meta.id}>{rowFor(meta)}</li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/**
 * The list's selection: what is ticked, how a click changes it, and the
 * two-step that deletes it.
 *
 * It lives in the list rather than in each caller because both surfaces that
 * show conversations (the sidebar's section and "Todas as conversas") are the
 * same list, and a selection implemented twice is two chances for Shift-click
 * to mean two different things.
 *
 * **Ticks are read through the visible rows, never trusted as stored.** The
 * window, the order and the search box all move under a selection; a tick that
 * outlived its row would be a conversation the next "Excluir" removes without
 * ever having shown it. See `conversationSelection.ts`.
 */
interface Selection {
  /** Multi-select is offered at all (the surface wired a bulk delete). */
  enabled: boolean
  /** How many rows **on screen** are ticked. */
  count: number
  has: (id: string) => boolean
  pick: (id: string, opts: { range: boolean }) => void
  pickAll: (checked: boolean) => void
  clear: () => void
  /** The bar is asking whether to delete the selection. */
  confirming: boolean
  askDelete: () => void
  cancelDelete: () => void
  confirmDelete: () => void
}

function useSelection(
  entries: readonly ChatSessionMeta[],
  onDeleteMany: ((ids: string[]) => void) | undefined
): Selection {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const ids = entries.map((meta) => meta.id)
  const onScreen = visible(ticked, ids)

  /**
   * Plain functions, not `useCallback`s.
   *
   * The rows they are handed to re-render on every keystroke of the search box
   * anyway (`entries` is a fresh array each render), so a memo here would be a
   * dependency list to keep correct in exchange for nothing. The honest
   * dependency is "the order of the rows", which is not a value React can
   * compare.
   */
  const clear = (): void => {
    setTicked(new Set())
    setAnchor(null)
    setConfirming(false)
  }

  const pick = (id: string, opts: { range: boolean }): void => {
    // A question about three rows is not a question about four: changing the
    // selection retracts it rather than silently re-aiming it.
    setConfirming(false)
    setTicked((current) => (opts.range ? extend(current, ids, anchor, id) : toggle(current, id)))
    if (!opts.range) setAnchor(id)
  }

  const pickAll = (checked: boolean): void => {
    setConfirming(false)
    setTicked((current) => setAll(current, ids, checked))
    setAnchor(null)
  }

  const confirmDelete = (): void => {
    onDeleteMany?.(onScreen)
    clear()
  }

  return {
    enabled: onDeleteMany !== undefined,
    count: onScreen.length,
    has: (id: string) => ticked.has(id),
    pick,
    pickAll,
    clear,
    confirming,
    askDelete: () => setConfirming(true),
    cancelDelete: () => setConfirming(false),
    confirmDelete
  }
}

/**
 * The row id a Space press is about, or `null` when the press belongs to
 * something else (the rename input, an action button, an empty list).
 *
 * At module scope for the reason the pane header's own helpers are: the list's
 * key handler is at the lint's branch ceiling, and "which element is this
 * press on" is a question, not part of the answer.
 */
function rowIdUnderSpace(event: KeyboardEvent<HTMLDivElement>): string | null {
  if (event.key !== ' ') return null
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.hasAttribute('data-history-open')) return null
  return target.getAttribute('data-history-id')
}

/**
 * The rows arrow-key roving applies to, or `null` when this press is not a
 * roving press.
 *
 * Editing keys belong to the title input and action buttons keep their own
 * keyboard behaviour, so roving only ever applies to the conversation-open
 * buttons.
 */
function rowsToRove(
  event: KeyboardEvent<HTMLDivElement>,
  list: HTMLDivElement | null
): HTMLButtonElement[] | null {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return null
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.hasAttribute('data-history-open')) return null
  const rows = Array.from(list?.querySelectorAll<HTMLButtonElement>('[data-history-open]') ?? [])
  return rows.length === 0 ? null : rows
}

/** Where one arrow/Home/End press lands, clamped to the ends of the list. */
function nextRowIndex(key: string, rows: HTMLButtonElement[], active: Element | null): number {
  const current = rows.indexOf(active as HTMLButtonElement)
  if (key === 'Home') return 0
  if (key === 'End') return rows.length - 1
  if (key === 'ArrowDown') return Math.min(current + 1, rows.length - 1)
  return Math.max(current - 1, 0)
}

/**
 * The bar over a list that has a selection: how many, select-all, and what can
 * be done to them — plus the two-step that deletes them.
 *
 * Its own component because the list body is at the lint's branch ceiling and
 * because this is a surface with three faces (idle, asking, and the counts in
 * between), none of which the rows care about.
 */
function SelectionToolbar({
  selection,
  total
}: {
  selection: Selection
  total: number
}): React.JSX.Element {
  return (
    <SelectionBar
      className="wb-history-selbar"
      count={selection.count}
      total={total}
      label={t('chatHistory.selectedCount', selection.count)}
      ariaLabel={t('chatHistory.selectedAria', selection.count)}
      selectAllLabel={t('chatHistory.selectAllLabel')}
      dismissLabel={t('chatHistory.selectionClearLabel')}
      onSelectAllChange={selection.pickAll}
      onDismiss={selection.clear}
      /* Two deliberate presses, inline — the same two-step the single row's
         delete already uses, and for the same reason it was chosen there: this
         list lives inside a sidebar on one surface and inside a dialog on the
         other, and a modal over either is a stack. Asking in the bar also
         leaves the ticked rows visible behind the question, which a scrim
         would dim. */
      {...(selection.confirming
        ? { prompt: t('chatHistory.deleteManyQuestion', selection.count) }
        : {})}
      actions={
        selection.confirming ? (
          <>
            <button
              type="button"
              className="wb-history-confirm-btn"
              data-danger="true"
              autoFocus
              onClick={selection.confirmDelete}
            >
              {t('chatHistory.deleteConfirmCta')}
            </button>
            <button
              type="button"
              className="wb-history-confirm-btn"
              onClick={selection.cancelDelete}
            >
              {t('chatHistory.deleteCancelCta')}
            </button>
          </>
        ) : (
          <button type="button" className="wb-history-bulk-btn" onClick={selection.askDelete}>
            <TrashIcon size={13} aria-hidden="true" />
            {t('chatHistory.deleteSelectedCta')}
          </button>
        )
      }
    />
  )
}
