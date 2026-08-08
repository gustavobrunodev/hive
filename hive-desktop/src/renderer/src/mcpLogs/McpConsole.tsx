import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input, SegmentedControl, Spinner } from '@hive/design-system'
import { t } from '../i18n'
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlugIcon,
  RefreshIcon,
  SearchIcon
} from '../ui/icons'
import {
  applyQuery,
  categoryLabel,
  countByFilter,
  describeEntry,
  durationScale,
  formatBandStamp,
  formatClock,
  formatLatency,
  groupBySession,
  hasDurationBar,
  LOG_FILTERS,
  serverStats,
  type LogFilterId,
  type LogQueryState,
  type McpLogEntry,
  type ServerStat
} from './logConsole'

/**
 * `McpConsole` — the workbench's bottom dock: what every MCP server actually
 * did while the agent worked.
 *
 * ## Why a dock and not a dialog
 *
 * The question this answers is "what is the MCP server doing *right now*, and
 * why is this turn slow" — which is a question you ask while the turn runs. A
 * modal would cover the transcript you're asking it about. So the console
 * docks under the work area, keeps its own height, and can grow to fill the
 * pane when an investigation deserves it, with the status bar carrying the
 * ambient signal when it's closed.
 *
 * ## Why rows and not a terminal
 *
 * `PRODUCT.md` names "log-dump UIs" as an anti-reference, and it's right: the
 * CLI's log lines are already structured (`mcpLogParse.ts` recovers the
 * structure), so rendering them as a wall of monospace throws away everything
 * that makes them scannable. Each event is a row on a shared timeline — time,
 * level, server, one sentence — with the raw text one disclosure away. The
 * only monospace here is where the content genuinely is machine output: tool
 * names, stack traces, and server stderr.
 *
 * ## The duration bar
 *
 * Timed tool rows carry a hairline bar scaled to the slowest call *currently
 * in view*, not to a fixed ceiling. The question is always comparative — which
 * of these calls ate the turn — and a fixed scale flattens a screen of fast
 * calls into nothing. It's drawn with `transform: scaleX()`, so a rescale
 * never touches layout.
 */

/** How tall the dock opens, and the bounds a drag may resize it to. */
const DEFAULT_HEIGHT = 264
const MIN_HEIGHT = 140

/** Within this many pixels of the bottom counts as "following the tail". */
const PIN_SLACK_PX = 32

/** Which of the four non-stream states the body should show, or null for the stream. */
type ConsoleStateKind = 'loading' | 'error' | 'empty' | 'nomatch'

function consoleState(
  loading: boolean,
  error: string | null,
  total: number,
  visible: number
): ConsoleStateKind | null {
  if (loading) return 'loading'
  if (error !== null) return 'error'
  // "Nothing at all" and "nothing in this filter" are different problems with
  // different exits — teaching copy vs. a way to clear the filter.
  if (total === 0) return 'empty'
  return visible === 0 ? 'nomatch' : null
}

/** The segmented control's label per view. */
function filterLabel(id: LogFilterId): string {
  if (id === 'all') return t('mcpLogs.filterAll')
  if (id === 'tools') return t('mcpLogs.filterTools')
  if (id === 'connection') return t('mcpLogs.filterConnection')
  return t('mcpLogs.filterIssues')
}

export interface McpConsoleProps {
  workspace: string
  /** Entries, sources and live state — hoisted so the status bar shares one subscription. */
  store: {
    entries: McpLogEntry[]
    sources: { server: string; dir: string; files: number; lastActivityAt: number | null }[]
    loading: boolean
    error: string | null
    freshIds: ReadonlySet<string>
    reload: () => void
  }
  /** Server names configured in this workspace's `.mcp.json`, to flag the ones that aren't. */
  catalog: string[]
  live: boolean
  onClose: () => void
  /** Opens the "Servidores MCP" manager — the empty state's way out. */
  onOpenManager: () => void
}

/**
 * The row's sentence. A row with a detail block (a stack, multi-line stderr)
 * makes the sentence the disclosure control, so the whole line is the target
 * rather than a separate chevron hit-box.
 */
function RowSummary({
  entry,
  open,
  onToggle
}: {
  entry: McpLogEntry
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const summary = describeEntry(entry)
  // Tool names and raw server output are machine text; the rest is prose.
  const mono = entry.kind === 'stderr' || entry.tool !== null
  const text = (
    <span className="wb-mcplog-text" data-mono={mono || undefined}>
      {summary}
    </span>
  )
  if (entry.detail === '') return <span className="wb-mcplog-summary">{text}</span>
  return (
    <button
      type="button"
      className="wb-mcplog-summary"
      aria-expanded={open}
      aria-label={t('mcpLogs.detailToggleAria', summary)}
      onClick={onToggle}
    >
      <ChevronRightIcon size={12} className="wb-mcplog-caret" />
      {text}
    </button>
  )
}

/** The latency cell: the number, with its share of the slowest call under it. */
function RowLatency({ entry, scale }: { entry: McpLogEntry; scale: number }): React.JSX.Element {
  if (entry.durationMs === null) return <span className="wb-mcplog-latency" />
  const latency = formatLatency(entry.durationMs)
  const bar = hasDurationBar(entry) && scale > 0 ? entry.durationMs / scale : null
  return (
    <span className="wb-mcplog-latency">
      <span className="wb-mcplog-latency-num">{latency}</span>
      {bar !== null && (
        <span
          className="wb-mcplog-meter"
          role="img"
          aria-label={t('mcpLogs.barAria', entry.tool ?? entry.server, latency)}
        >
          <span className="wb-mcplog-meter-fill" style={{ transform: `scaleX(${bar})` }} />
        </span>
      )}
    </span>
  )
}

/** Copies the entry's original JSON line, confirming in place for a moment. */
function RowCopy({ raw }: { raw: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(id)
  }, [copied])
  return (
    <button
      type="button"
      className="wb-mcplog-copy"
      aria-label={t('mcpLogs.copyAria')}
      onClick={() => void navigator.clipboard?.writeText(raw).then(() => setCopied(true))}
    >
      {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
    </button>
  )
}

/** One event as a row on the timeline. */
function EventRow({
  entry,
  scale,
  showServer,
  fresh
}: {
  entry: McpLogEntry
  scale: number
  showServer: boolean
  fresh: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="wb-mcplog-row"
      data-level={entry.level}
      data-kind={entry.kind}
      data-fresh={fresh || undefined}
      data-open={open || undefined}
    >
      <span className="wb-mcplog-time">{formatClock(entry.at)}</span>
      <span className="wb-mcplog-dot" data-level={entry.level} aria-hidden="true">
        {entry.level === 'error' ? <AlertTriangleIcon size={11} /> : null}
      </span>
      <span className="wb-mcplog-cat">{categoryLabel(entry)}</span>
      {/* Always rendered, so the row's grid columns line up down the page —
        scoped to one server it collapses to zero width rather than shifting
        every following column left. */}
      <span className="wb-mcplog-server">{showServer ? entry.server : ''}</span>
      <RowSummary entry={entry} open={open} onToggle={() => setOpen((current) => !current)} />
      <RowLatency entry={entry} scale={scale} />
      <RowCopy raw={entry.raw} />
      {open && (
        <pre className="wb-mcplog-detail" tabIndex={0}>
          {entry.detail}
        </pre>
      )}
    </div>
  )
}

/** The rule that separates one CLI session's events from the next. */
function SessionBand({
  startedAt,
  count
}: {
  startedAt: number
  count: number
}): React.JSX.Element {
  return (
    <div className="wb-mcplog-band" role="separator">
      <span className="wb-mcplog-band-label">
        {t('mcpLogs.bandLabel', formatBandStamp(startedAt))}
      </span>
      <span className="wb-mcplog-band-count">{t('mcpLogs.bandCount', count)}</span>
    </div>
  )
}

/** One server's card in the expanded console's rail. */
function ServerCard({
  stat,
  inCatalog,
  selected,
  onSelect,
  onOpenDir
}: {
  stat: ServerStat
  inCatalog: boolean
  selected: boolean
  onSelect: () => void
  onOpenDir: () => void
}): React.JSX.Element {
  return (
    <div className="wb-mcplog-card" data-selected={selected || undefined}>
      <button type="button" className="wb-mcplog-card-main" onClick={onSelect}>
        <span className="wb-mcplog-card-head">
          <span
            className="wb-mcplog-card-dot"
            data-live={stat.live || undefined}
            aria-hidden="true"
          />
          <span className="wb-mcplog-card-name">{stat.server}</span>
        </span>
        <span className="wb-mcplog-card-state">
          {stat.live ? t('mcpLogs.railLive') : t('mcpLogs.railOffline')}
        </span>
        <span className="wb-mcplog-card-metrics">
          <span>{t('mcpLogs.railCalls', stat.calls)}</span>
          {stat.errors > 0 && (
            <span className="wb-mcplog-card-errors">{t('mcpLogs.railErrors', stat.errors)}</span>
          )}
        </span>
        {stat.medianMs !== null && stat.slowestMs !== null && (
          <span className="wb-mcplog-card-metrics">
            <span>{t('mcpLogs.railMedian', formatLatency(stat.medianMs))}</span>
            <span>{t('mcpLogs.railSlowest', formatLatency(stat.slowestMs))}</span>
          </span>
        )}
        {!inCatalog && (
          <span className="wb-mcplog-card-foreign">{t('mcpLogs.railNotInCatalog')}</span>
        )}
      </button>
      <button
        type="button"
        className="wb-mcplog-card-dir"
        aria-label={t('mcpLogs.openDirAria', stat.server)}
        title={t('mcpLogs.openDirCta')}
        onClick={onOpenDir}
      >
        <ExternalLinkIcon size={12} />
      </button>
    </div>
  )
}

/** Loading, read failure, nothing-ever, or nothing-in-this-filter. */
function ConsoleEmpty({
  kind,
  onPrimary
}: {
  kind: ConsoleStateKind
  onPrimary: () => void
}): React.JSX.Element {
  if (kind === 'loading') {
    return (
      <div className="wb-mcplog-state">
        <Spinner label={t('mcpLogs.loadingLabel')} />
      </div>
    )
  }
  const isError = kind === 'error'
  const isEmpty = kind === 'empty'
  return (
    <div className="wb-mcplog-state">
      <span className="wb-mcplog-state-mark" aria-hidden="true">
        {isError ? <AlertTriangleIcon size={18} /> : <PlugIcon size={18} />}
      </span>
      <p className="wb-mcplog-state-title">
        {isError
          ? t('mcpLogs.errorTitle')
          : isEmpty
            ? t('mcpLogs.emptyTitle')
            : t('mcpLogs.noMatchTitle')}
      </p>
      <p className="wb-mcplog-state-desc">
        {isEmpty ? t('mcpLogs.emptyDescription') : isError ? '' : t('mcpLogs.noMatchDescription')}
      </p>
      <button type="button" className="wb-mcplog-state-cta" onClick={onPrimary}>
        {isError ? <RefreshIcon size={13} /> : isEmpty ? <PlugIcon size={13} /> : null}
        {isError
          ? t('mcpLogs.retryCta')
          : isEmpty
            ? t('mcpLogs.emptyCta')
            : t('mcpLogs.clearFiltersCta')}
      </button>
    </div>
  )
}

export function McpConsole({
  workspace,
  store,
  catalog,
  live,
  onClose,
  onOpenManager
}: McpConsoleProps): React.JSX.Element {
  const [query, setQuery] = useState<LogQueryState>({ server: null, filter: 'all', search: '' })
  const [maximized, setMaximized] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [pinned, setPinned] = useState(true)
  const [unseen, setUnseen] = useState(0)
  const streamRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => applyQuery(store.entries, query), [store.entries, query])
  const counts = useMemo(
    () => countByFilter(store.entries, { server: query.server, search: query.search }),
    [store.entries, query.server, query.search]
  )
  const scale = useMemo(() => durationScale(visible), [visible])
  const groups = useMemo(() => groupBySession(visible), [visible])
  const stats = useMemo(() => serverStats(store.entries), [store.entries])
  const catalogSet = useMemo(() => new Set(catalog), [catalog])

  /** Scrolls the stream to the newest row and re-pins the tail. */
  const scrollToTail = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    stream.scrollTop = stream.scrollHeight
    setPinned(true)
    setUnseen(0)
  }, [])

  // Follow the tail while pinned; otherwise count what arrived out of view so
  // the pill can offer the trip back, the way a chat transcript does. Counted
  // as a delta, not a bump per render: one watch batch can carry a dozen rows.
  const seenLength = useRef(store.entries.length)
  useEffect(() => {
    const added = store.entries.length - seenLength.current
    seenLength.current = store.entries.length
    if (added <= 0) return
    if (pinned) scrollToTail()
    else setUnseen((current) => current + added)
    // Only the arrival of new rows should move the viewport — not a filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.entries.length])

  const handleScroll = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const atBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight <= PIN_SLACK_PX
    setPinned(atBottom)
    if (atBottom) setUnseen(0)
  }, [])

  /** Pointer-drag resize of the dock's height, bounded by the window. */
  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (maximized) return
      event.preventDefault()
      const startY = event.clientY
      const startHeight = height
      const max = Math.max(MIN_HEIGHT, window.innerHeight - 180)
      const move = (moveEvent: PointerEvent): void => {
        const next = startHeight + (startY - moveEvent.clientY)
        setHeight(Math.min(max, Math.max(MIN_HEIGHT, next)))
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [height, maximized]
  )

  const clearFilters = useCallback(() => setQuery({ server: null, filter: 'all', search: '' }), [])

  // Publish the dock's footprint on the document root so viewport-fixed
  // furniture can get out of its way — the Second Brain FAB is anchored to the
  // bottom-right and would otherwise sit on top of the newest rows, which is
  // exactly where the eye goes. Measured rather than derived from `height`, so
  // a drag-resize and the maximized state both land without a second rule.
  const dockRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const node = dockRef.current
    const publish = (): void => root.style.setProperty('--wb-dock-h', `${node?.offsetHeight ?? 0}px`)
    publish()
    const observer =
      node !== null && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    if (node !== null) observer?.observe(node)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--wb-dock-h')
    }
  }, [])

  // Maximized, the dock owns the work area outright; floating furniture hides
  // rather than being pushed off the top of the viewport.
  useEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-dock-maximized', maximized)
    return () => root.removeAttribute('data-dock-maximized')
  }, [maximized])

  const stateKind = consoleState(store.loading, store.error, store.entries.length, visible.length)
  const onPrimary =
    stateKind === 'error' ? store.reload : stateKind === 'empty' ? onOpenManager : clearFilters

  return (
    <section
      ref={dockRef}
      className="wb-mcplog"
      data-maximized={maximized || undefined}
      style={maximized ? undefined : { height: `${height}px` }}
      aria-label={t('mcpLogs.title')}
    >
      <div
        className="wb-mcplog-grip"
        role="separator"
        aria-label={t('mcpLogs.resizeAria')}
        aria-orientation="horizontal"
        onPointerDown={startResize}
      />
      <header className="wb-mcplog-bar">
        <span className="wb-mcplog-mark" aria-hidden="true">
          <ActivityIcon size={14} />
        </span>
        <h2 className="wb-mcplog-title">{t('mcpLogs.title')}</h2>
        {live && (
          <span className="wb-mcplog-live" title={t('mcpLogs.liveAria')}>
            <span className="wb-mcplog-live-dot" aria-hidden="true" />
            {t('mcpLogs.liveLabel')}
          </span>
        )}
        <SegmentedControl
          className="wb-mcplog-filters"
          ariaLabel={t('mcpLogs.filterAria')}
          value={query.filter}
          onChange={(id) => setQuery((current) => ({ ...current, filter: id as LogFilterId }))}
          options={LOG_FILTERS.map((id) => ({
            id,
            label: filterLabel(id),
            count: counts[id],
            tone: id === 'issues' ? ('danger' as const) : undefined
          }))}
        />
        <div className="wb-mcplog-search">
          <SearchIcon size={13} className="wb-mcplog-search-icon" />
          <Input
            value={query.search}
            aria-label={t('mcpLogs.searchAria')}
            placeholder={t('mcpLogs.searchPlaceholder')}
            onChange={(event) =>
              setQuery((current) => ({ ...current, search: event.target.value }))
            }
          />
        </div>
        <button
          type="button"
          className="wb-mcplog-iconbtn"
          aria-label={maximized ? t('mcpLogs.collapseAria') : t('mcpLogs.expandAria')}
          onClick={() => setMaximized((current) => !current)}
        >
          {maximized ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>
        <button
          type="button"
          className="wb-mcplog-iconbtn"
          aria-label={t('mcpLogs.closeAria')}
          onClick={onClose}
        >
          <CloseIcon size={14} />
        </button>
      </header>

      <div className="wb-mcplog-body">
        {maximized && stats.length > 0 && (
          <aside className="wb-mcplog-rail" aria-label={t('mcpLogs.railHeading')}>
            <span className="wb-mcplog-rail-head">{t('mcpLogs.railHeading')}</span>
            {stats.map((stat) => (
              <ServerCard
                key={stat.server}
                stat={stat}
                inCatalog={catalogSet.has(stat.server)}
                selected={query.server === stat.server}
                onSelect={() =>
                  setQuery((current) => ({
                    ...current,
                    server: current.server === stat.server ? null : stat.server
                  }))
                }
                onOpenDir={() => void window.hive.mcpLogs.openDir(workspace, stat.server)}
              />
            ))}
          </aside>
        )}

        <div className="wb-mcplog-streamwrap">
          {stateKind !== null ? (
            <ConsoleEmpty kind={stateKind} onPrimary={onPrimary} />
          ) : (
            <div
              ref={streamRef}
              className="wb-mcplog-stream"
              onScroll={handleScroll}
              role="log"
              aria-live="off"
              aria-label={t('mcpLogs.title')}
            >
              {groups.map((group) => (
                <div key={`${group.sessionId ?? 'none'}-${group.startedAt}`}>
                  <SessionBand startedAt={group.startedAt} count={group.entries.length} />
                  {group.entries.map((entry) => (
                    <EventRow
                      key={entry.id}
                      entry={entry}
                      scale={scale}
                      showServer={query.server === null}
                      fresh={store.freshIds.has(entry.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          {unseen > 0 && (
            <button
              type="button"
              className="wb-mcplog-follow"
              aria-label={t('mcpLogs.followAria')}
              onClick={scrollToTail}
            >
              <ArrowDownIcon size={12} />
              {t('mcpLogs.followCta', unseen)}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
