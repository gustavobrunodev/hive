import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input, SegmentedControl } from '@hive/design-system'
import { t } from '../i18n'
import {
  ArrowDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  CheckIcon,
  MaximizeIcon,
  MinimizeIcon,
  SearchIcon,
  SourceControlIcon,
  TrashIcon
} from '../ui/icons'
import { copyText } from '../ui/clipboard'
import {
  applyFilter,
  commandLine,
  countByFilter,
  failed,
  formatClock,
  formatDuration,
  GIT_LOG_FILTERS,
  outcomeLabel,
  slow,
  toPlainText,
  type GitCommandEntry,
  type GitLogFilterId
} from './gitLogs'
import { useGitLogs } from './useGitLogs'

/**
 * `GitLogConsole` — every `git` the app ran, in the order it ran them.
 *
 * ## Why it exists
 *
 * The Source Control panel already tells the truth when one command fails: it
 * shows git's own stderr rather than a house error (D-GIT-1). What it cannot
 * show is the *sequence*, and almost every git question that is actually hard
 * is a question about the sequence — this `push` failed but that `fetch`
 * worked, this `status` answered for a directory nobody expected, the panel
 * went quiet for four seconds and nothing errored at all. VS Code answers this
 * with the Git output channel, and it is the instrument people already know.
 *
 * ## Why a dock and not a dialog
 *
 * Same reason as the MCP console: this is read *while* something is wrong with
 * the panel beside it, and a modal covers the thing being asked about. It
 * docks under the work area, keeps its own height, and can take the whole area
 * when an investigation earns it.
 *
 * ## Why rows and not a text dump
 *
 * `PRODUCT.md` names log-dump UIs as an anti-reference, and the entries here
 * are already structured — command, directory, duration, exit code, stderr —
 * so printing them as one monospace wall would throw away the scan the console
 * exists to support: which row is red, which row is slow. The raw wall is
 * still one click away as "Copiar tudo", because the moment a log leaves the
 * app for an issue tracker, plain text is the right format.
 */

/** How tall the dock opens, and the floor a drag may resize it to. */
const DEFAULT_HEIGHT = 264
const MIN_HEIGHT = 140

/** Within this many pixels of the bottom counts as "following the tail". */
const PIN_SLACK_PX = 32

/** Which non-stream state the body should show, or null for the stream. */
type ConsoleStateKind = 'loading' | 'empty' | 'nomatch'

function consoleState(loading: boolean, total: number, visible: number): ConsoleStateKind | null {
  if (loading) return 'loading'
  // "Nothing ran" and "nothing matches" are different problems with different
  // exits — teaching copy vs. a way back out of the filter.
  if (total === 0) return 'empty'
  return visible === 0 ? 'nomatch' : null
}

export interface GitLogConsoleProps {
  onClose: () => void
}

/** One command: the time, the command line, its cost, and how it ended. */
function CommandRow({ entry }: { entry: GitCommandEntry }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const command = commandLine(entry)
  const outcome = outcomeLabel(entry)
  const duration = formatDuration(entry.durationMs)
  const hasDetail = entry.stderr.trim() !== ''
  return (
    <div
      className="wb-gitlog-row"
      data-failed={failed(entry) || undefined}
      data-slow={slow(entry) || undefined}
    >
      <div className="wb-gitlog-line">
        <span className="wb-gitlog-time">{formatClock(entry.at)}</span>
        {hasDetail ? (
          <button
            type="button"
            className="wb-gitlog-cmd wb-gitlog-cmd-btn"
            aria-expanded={open}
            aria-label={t('gitLogs.detailToggleAria', command)}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronRightIcon size={12} className="wb-gitlog-caret" />
            <span className="wb-gitlog-cmd-text">{command}</span>
          </button>
        ) : (
          <span className="wb-gitlog-cmd">
            <span className="wb-gitlog-cmd-text">{command}</span>
          </span>
        )}
        <span className="wb-gitlog-dur">{duration}</span>
        <span className="wb-gitlog-outcome">{outcome}</span>
      </div>
      {/* The directory is on its own line and quiet: it is the same for nearly
          every row, so putting it in the main line would repeat one string
          down the whole console and push the command off the right edge. It
          still has to be *present*, because a command answering for the wrong
          directory is one of the two failures this console exists to catch. */}
      <span className="wb-gitlog-cwd" title={t('gitLogs.cwdAria', entry.cwd)}>
        {entry.cwd}
      </span>
      {open && hasDetail && (
        <pre className="wb-gitlog-stderr">
          {entry.stderr}
          {entry.stderrTruncated && (
            <span className="wb-gitlog-stderr-cut">{t('gitLogs.stderrTruncated')}</span>
          )}
        </pre>
      )}
    </div>
  )
}

/** Copies the visible rows as plain text, confirming in place for a moment. */
function CopyAll({ entries }: { entries: GitCommandEntry[] }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(id)
  }, [copied])
  return (
    <button
      type="button"
      className="wb-gitlog-cmdbtn"
      aria-label={t('gitLogs.copyAria')}
      onClick={() => {
        void copyText(toPlainText(entries))
        setCopied(true)
      }}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? t('gitLogs.copiedLabel') : t('gitLogs.copyLabel')}
    </button>
  )
}

/** The three non-stream states, each with its own way forward. */
function ConsoleState({
  kind,
  onClearFilters
}: {
  kind: ConsoleStateKind
  onClearFilters: () => void
}): React.JSX.Element {
  if (kind === 'loading') {
    return <div className="wb-gitlog-state">{t('gitLogs.loading')}</div>
  }
  const empty = kind === 'empty'
  return (
    <div className="wb-gitlog-state">
      <p className="wb-gitlog-state-title">
        {empty ? t('gitLogs.emptyTitle') : t('gitLogs.nomatchTitle')}
      </p>
      <p className="wb-gitlog-state-desc">
        {empty ? t('gitLogs.emptyDescription') : t('gitLogs.nomatchDescription')}
      </p>
      {!empty && (
        <button type="button" className="wb-gitlog-cmdbtn" onClick={onClearFilters}>
          {t('gitLogs.nomatchCta')}
        </button>
      )}
    </div>
  )
}

export function GitLogConsole({ onClose }: GitLogConsoleProps): React.JSX.Element {
  const store = useGitLogs()
  const [filter, setFilter] = useState<GitLogFilterId>('all')
  const [search, setSearch] = useState('')
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [maximized, setMaximized] = useState(false)

  const counts = useMemo(() => countByFilter(store.entries), [store.entries])
  const visible = useMemo(
    () => applyFilter(store.entries, filter, search),
    [store.entries, filter, search]
  )

  // Tail-following: stay pinned to the newest row unless the reader has
  // scrolled away, in which case a button offers the trip back rather than
  // yanking the viewport out from under them mid-read.
  const streamRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(true)
  const handleScroll = useCallback(() => {
    const node = streamRef.current
    if (node === null) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    setPinned(distance <= PIN_SLACK_PX)
  }, [])
  useEffect(() => {
    const node = streamRef.current
    if (node === null || !pinned) return
    node.scrollTop = node.scrollHeight
  }, [visible.length, pinned])

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (maximized) return
      event.preventDefault()
      const startY = event.clientY
      const startHeight = height
      const max = Math.max(MIN_HEIGHT, window.innerHeight - 180)
      const move = (moveEvent: PointerEvent): void => {
        setHeight(Math.min(max, Math.max(MIN_HEIGHT, startHeight + (startY - moveEvent.clientY))))
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

  // Publish the dock's footprint (the MCP console's rule, and the same reason):
  // the Second Brain FAB is anchored bottom-right and would otherwise cover the
  // newest rows, which is exactly where the eye goes.
  const dockRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const node = dockRef.current
    const publish = (): void =>
      root.style.setProperty('--wb-dock-h', `${node?.offsetHeight ?? 0}px`)
    publish()
    const observer =
      node !== null && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    if (node !== null) observer?.observe(node)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--wb-dock-h')
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-dock-maximized', maximized)
    return () => root.removeAttribute('data-dock-maximized')
  }, [maximized])

  const clearFilters = useCallback(() => {
    setFilter('all')
    setSearch('')
  }, [])

  const stateKind = consoleState(store.loading, store.entries.length, visible.length)

  return (
    <section
      ref={dockRef}
      className="wb-gitlog"
      data-maximized={maximized || undefined}
      style={maximized ? undefined : { height: `${height}px` }}
      aria-label={t('gitLogs.title')}
    >
      <div
        className="wb-gitlog-grip"
        role="separator"
        aria-label={t('gitLogs.resizeAria')}
        aria-orientation="horizontal"
        onPointerDown={startResize}
      />
      <header className="wb-gitlog-bar">
        <span className="wb-gitlog-mark" aria-hidden="true">
          <SourceControlIcon size={14} />
        </span>
        <h2 className="wb-gitlog-title">{t('gitLogs.title')}</h2>
        <SegmentedControl
          className="wb-gitlog-filters"
          ariaLabel={t('gitLogs.filterAria')}
          value={filter}
          onChange={(id) => setFilter(id as GitLogFilterId)}
          options={GIT_LOG_FILTERS.map((option) => ({
            id: option.id,
            label: option.label,
            count: counts[option.id],
            tone: option.id === 'failed' ? ('danger' as const) : undefined
          }))}
        />
        <div className="wb-gitlog-search">
          <SearchIcon size={13} className="wb-gitlog-search-icon" />
          <Input
            value={search}
            aria-label={t('gitLogs.searchAria')}
            placeholder={t('gitLogs.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <CopyAll entries={visible} />
        <button
          type="button"
          className="wb-gitlog-cmdbtn"
          aria-label={t('gitLogs.clearAria')}
          onClick={store.clear}
        >
          <TrashIcon size={13} />
          {t('gitLogs.clearLabel')}
        </button>
        <button
          type="button"
          className="wb-gitlog-iconbtn"
          aria-label={maximized ? t('gitLogs.collapseAria') : t('gitLogs.expandAria')}
          onClick={() => setMaximized((current) => !current)}
        >
          {maximized ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>
        <button
          type="button"
          className="wb-gitlog-iconbtn"
          aria-label={t('gitLogs.closeAria')}
          onClick={onClose}
        >
          <CloseIcon size={14} />
        </button>
      </header>

      <div className="wb-gitlog-body">
        {stateKind !== null ? (
          <ConsoleState kind={stateKind} onClearFilters={clearFilters} />
        ) : (
          <div
            ref={streamRef}
            className="wb-gitlog-stream"
            onScroll={handleScroll}
            role="log"
            aria-live="off"
            aria-label={t('gitLogs.title')}
          >
            {visible.map((entry) => (
              <CommandRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
        {!pinned && stateKind === null && (
          <button
            type="button"
            className="wb-gitlog-tail"
            aria-label={t('gitLogs.followAria')}
            onClick={() => {
              setPinned(true)
              const node = streamRef.current
              if (node !== null) node.scrollTop = node.scrollHeight
            }}
          >
            <ArrowDownIcon size={12} />
            {t('gitLogs.followCta')}
          </button>
        )}
      </div>
    </section>
  )
}
