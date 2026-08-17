import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Empty, Popover, PopoverContent, PopoverTrigger, Skeleton } from '@hive/design-system'
import { relativeTimeLabel, t } from '../i18n'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'
import { IconButton } from '../ui/IconButton'
import {
  ChatBubbleIcon,
  CheckIcon,
  CloseIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon
} from '../ui/icons'

type GroupKey = 'today' | 'yesterday' | 'week' | 'month' | 'older'

const GROUP_ORDER: readonly GroupKey[] = ['today', 'yesterday', 'week', 'month', 'older']

const GROUP_LABEL_KEY = {
  today: 'chatHistory.groupToday',
  yesterday: 'chatHistory.groupYesterday',
  week: 'chatHistory.groupWeek',
  month: 'chatHistory.groupMonth',
  older: 'chatHistory.groupOlder'
} as const

/** Claude-Desktop-style recency buckets, cut on calendar-day boundaries (an 11 pm chat is still "Hoje" at 1 am — no, it's "Ontem": calendar days, exactly like the reference apps). */
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

/** Per-row transient UI state: which row is being renamed / has its delete armed. */
interface RowMode {
  id: string
  kind: 'rename' | 'confirm-delete'
}

interface HistoryRowProps {
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
}

/**
 * One conversation row. Three faces: the default open-button + hover actions,
 * an inline rename editor, and an inline delete confirmation — inline (not a
 * nested dialog) so the flow never stacks a modal on a popover.
 */
function HistoryRow({
  meta,
  active,
  running,
  reviewPending,
  mode,
  now,
  onOpen,
  onModeChange,
  onRename,
  onDelete
}: HistoryRowProps): React.JSX.Element {
  const title = sessionTitle(meta)
  const [draft, setDraft] = useState(title)

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
    <div className="wb-history-row" data-active={active || undefined}>
      <button
        type="button"
        className="wb-history-open"
        data-history-open="true"
        aria-label={
          reviewPending > 0
            ? t('chatHistory.openWithReviewAria', title, reviewPending)
            : t('chatHistory.openAria', title)
        }
        aria-current={active ? 'true' : undefined}
        onClick={() => onOpen(meta.id)}
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

export interface SessionHistoryProps {
  /** Active workspace — sessions are listed per workspace. */
  workspace: string
  /** The conversation currently open in the chat pane (highlight + delete-clears-pane coupling). */
  activeSessionId: string | null
  /** background-turns: conversation ids whose reply is still being generated ("Em andamento" rows). */
  runningSessionIds?: readonly string[]
  /**
   * Agent Change Review: conversation id → how many pending files its turns
   * left behind. A turn's change card renders only in the conversation it was
   * asked from, so this is what keeps a review waiting in another conversation
   * findable instead of merely hidden.
   */
  reviewPendingBySession?: Readonly<Record<string, number>>
  /** Starts a fresh conversation in the chat pane. Also invoked after the active session is deleted. */
  onNewConversation: () => void
  /** Restores a stored conversation into the chat pane. */
  onOpenSession: (id: string) => void
}

/**
 * Session history (session-history) — the chat pane header's two primary
 * actions: "Nova conversa" and the history popover (search + recency-grouped
 * conversation list with inline rename/delete), Claude-Desktop-style. Data
 * loads fresh on every open (same lazy pattern as the workspace chip menu's
 * recents), so the list never goes stale while staying subscription-free.
 */
export function SessionHistory({
  workspace,
  activeSessionId,
  runningSessionIds = [],
  reviewPendingBySession = {},
  onNewConversation,
  onOpenSession
}: SessionHistoryProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // `null` = first load in flight → skeleton rows, never a flash of "empty".
  const [sessions, setSessions] = useState<ChatSessionMeta[] | null>(null)
  // Captured when the list loads — the render-stable "now" every relative
  // time and recency bucket derives from (react-hooks/purity: no Date.now()
  // during render; the panel reloads on every open, so it never goes stale).
  const [loadedAt, setLoadedAt] = useState(0)
  const [query, setQuery] = useState('')
  // Full-text results from the main process (searches every message's text,
  // accent-insensitive), tagged with the query they answer so a stale
  // response can never overwrite a newer keystroke's view.
  const [ftResults, setFtResults] = useState<{ query: string; entries: ChatSessionMeta[] } | null>(
    null
  )
  const [rowMode, setRowMode] = useState<RowMode | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const reload = useCallback((): void => {
    const at = Date.now()
    window.hive.chatHistory
      .list(workspace)
      .then((list) => {
        setSessions(list)
        setLoadedAt(at)
      })
      .catch(() => {
        setSessions([])
        setLoadedAt(at)
      })
  }, [workspace])

  const handleOpenChange = useCallback(
    (next: boolean): void => {
      setOpen(next)
      if (next) {
        setSessions(null)
        setQuery('')
        setFtResults(null)
        setRowMode(null)
        reload()
      }
    },
    [reload]
  )

  const handleOpenSession = useCallback(
    (id: string): void => {
      setOpen(false)
      onOpenSession(id)
    },
    [onOpenSession]
  )

  const handleRename = useCallback(
    (id: string, title: string): void => {
      window.hive.chatHistory
        .rename(workspace, id, title)
        .then((meta) => {
          if (meta) {
            setSessions((current) =>
              current ? current.map((entry) => (entry.id === id ? meta : entry)) : current
            )
            setFtResults((current) =>
              current
                ? {
                    ...current,
                    entries: current.entries.map((entry) =>
                      entry.id === id ? { ...meta, match: entry.match } : entry
                    )
                  }
                : current
            )
          } else {
            reload()
          }
        })
        .catch(reload)
    },
    [workspace, reload]
  )

  const handleDelete = useCallback(
    (id: string): void => {
      setRowMode(null)
      window.hive.chatHistory
        .delete(workspace, id)
        .then(() => {
          setSessions((current) => (current ? current.filter((entry) => entry.id !== id) : current))
          setFtResults((current) =>
            current
              ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) }
              : current
          )
          // The open transcript belongs to the deleted conversation — reset
          // the pane to a fresh one instead of leaving a ghost transcript.
          if (id === activeSessionId) onNewConversation()
        })
        .catch(reload)
    },
    [workspace, activeSessionId, onNewConversation, reload]
  )

  // Escape peels transient state one layer at a time before closing:
  // rename/delete-confirm → search query → the popover itself.
  const handleEscapeKeyDown = useCallback(
    (event: Event): void => {
      if (rowMode) {
        event.preventDefault()
        setRowMode(null)
      } else if (query !== '') {
        event.preventDefault()
        setQuery('')
      }
    },
    [rowMode, query]
  )

  /** ArrowUp/ArrowDown/Home/End move focus across the visible conversation rows. */
  const handleListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-history-open]') ?? []
    )
    if (rows.length === 0) return
    event.preventDefault()
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(current + 1, rows.length - 1)
            : Math.max(current - 1, 0)
    rows[next]?.focus()
  }, [])

  // Debounced full-text search — one IPC per settled keystroke burst. The
  // local title/preview filter below answers instantly in the meantime, so
  // typing never feels gated on the round trip. A cleared query needs no
  // state reset here: stale results are already ignored by the
  // `ftResults.query === query` guard below.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === '') return
    const timer = setTimeout(() => {
      window.hive.chatHistory
        .search(workspace, trimmed)
        .then((entries) => setFtResults({ query: trimmed, entries }))
        .catch(() => {})
    }, 120)
    return () => clearTimeout(timer)
  }, [query, workspace])

  const needle = query.trim().toLowerCase()
  const localFiltered = (sessions ?? []).filter(
    (meta) =>
      needle === '' || `${sessionTitle(meta)} ${meta.preview}`.toLowerCase().includes(needle)
  )
  const filtered =
    needle !== '' && ftResults?.query === query.trim() ? ftResults.entries : localFiltered

  const groups = GROUP_ORDER.map((key) => ({
    key,
    entries: filtered.filter((meta) => groupKeyOf(meta.updatedAt, loadedAt) === key)
  })).filter((group) => group.entries.length > 0)

  function renderBody(): React.JSX.Element {
    if (sessions === null) {
      return (
        <div className="wb-history-loading" aria-label={t('chatHistory.loadingLabel')}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="wb-history-skeleton">
              <Skeleton style={{ width: `${72 - index * 14}%`, height: 13 }} />
              <Skeleton style={{ width: 88, height: 10 }} />
            </div>
          ))}
        </div>
      )
    }
    if (sessions.length === 0) {
      return (
        <Empty
          className="wb-history-empty"
          icon={<ChatBubbleIcon size={22} />}
          title={t('chatHistory.emptyTitle')}
          description={t('chatHistory.emptyDescription')}
        />
      )
    }
    if (filtered.length === 0) {
      return <p className="wb-history-nomatch">{t('chatHistory.noMatch', query.trim())}</p>
    }
    return (
      <div
        ref={listRef}
        className="wb-history-list"
        role="presentation"
        onKeyDown={handleListKeyDown}
      >
        {groups.map((group) => (
          <section key={group.key} className="wb-history-group">
            <h3 className="wb-history-group-label">{t(GROUP_LABEL_KEY[group.key])}</h3>
            <ul className="wb-history-group-list">
              {group.entries.map((meta) => (
                <li key={meta.id}>
                  <HistoryRow
                    meta={meta}
                    active={meta.id === activeSessionId}
                    running={runningSessionIds.includes(meta.id)}
                    reviewPending={reviewPendingBySession[meta.id] ?? 0}
                    mode={rowMode?.id === meta.id ? rowMode : null}
                    now={loadedAt}
                    onOpen={handleOpenSession}
                    onModeChange={setRowMode}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <>
      <IconButton
        label={t('chatHistory.newLabel')}
        className="wb-history-trigger"
        onClick={onNewConversation}
      >
        <PlusIcon size={15} />
      </IconButton>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <IconButton label={t('chatHistory.historyLabel')} className="wb-history-trigger">
            <HistoryIcon size={15} />
          </IconButton>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            align="end"
            sideOffset={6}
            className="wb-history-pop"
            aria-label={t('chatHistory.panelTitle')}
            onEscapeKeyDown={handleEscapeKeyDown}
          >
            <div className="wb-history-search">
              <SearchIcon size={14} className="wb-history-search-icon" />
              <input
                className="wb-history-search-input"
                type="text"
                value={query}
                placeholder={t('chatHistory.searchPlaceholder')}
                aria-label={t('chatHistory.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query !== '' && (
                <IconButton
                  label={t('chatHistory.searchClearLabel')}
                  className="wb-history-search-clear"
                  onClick={() => setQuery('')}
                >
                  <CloseIcon size={12} />
                </IconButton>
              )}
            </div>
            {renderBody()}
          </PopoverContent>
        )}
      </Popover>
    </>
  )
}
