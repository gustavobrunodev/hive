import { Fragment } from 'react'
import { t } from '../i18n'
import {
  gitStatusColor,
  statusKind,
  statusLetter,
  type GitFileChange,
  type GitGroups,
  type GitStatusKind
} from './gitStatus'

/**
 * Cap on rows rendered per group so a repo with thousands of changed files
 * can't freeze the renderer (GIT-R2 perf) — the container scrolls, and any
 * overflow is summarized with an "e mais N…" line rather than mounting every
 * row. A pragmatic guard in place of full windowing (deferred).
 */
const MAX_ROWS_PER_GROUP = 500

/** Human meaning of a status kind, for the row's accessible name (color/letter alone isn't enough). */
function kindMeaning(kind: GitStatusKind): string {
  switch (kind) {
    case 'added':
      return t('git.statusAdded')
    case 'deleted':
      return t('git.statusDeleted')
    case 'renamed':
      return t('git.statusRenamed')
    case 'untracked':
      return t('git.statusUntracked')
    case 'conflict':
      return t('git.statusConflict')
    case 'ignored':
      return t('git.statusIgnored')
    default:
      return t('git.statusModified')
  }
}

/** Basename of a workspace-relative POSIX path. */
function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Directory portion (without trailing slash), or '' at the root. */
function dirName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/**
 * The folder shown beside a file name, split so it clips in the **middle**
 * rather than at the end.
 *
 * A change list full of agent output is a list of deep paths — four files in
 * `_bmad-output/planning-artifacts/prds/prd-teste-hive-2026-09-03` were all
 * rendering as `_bmad-outp…`, `_bmad-o…`, `_bmad…`: the same useless prefix,
 * three different truncations, no way to tell which folder any row was in. The
 * deepest segment is the one that distinguishes files, so it is never the part
 * that gets dropped — the head absorbs the squeeze (`_bmad-output/pl…/prd-teste-…`)
 * and only clips itself once the leaf no longer fits.
 */
function splitDir(dir: string): { head: string; tail: string } {
  const i = dir.lastIndexOf('/')
  return i === -1 ? { head: '', tail: dir } : { head: dir.slice(0, i + 1), tail: dir.slice(i + 1) }
}

/** Which group a row belongs to — drives the staged-vs-unstaged badge fill. */
type RowSide = 'conflict' | 'staged' | 'unstaged'

interface ChangeRowProps {
  change: GitFileChange
  side: RowSide
  /** Opens this change's diff (wired in T20); the row is a button either way for keyboard parity. */
  onOpenDiff?: (change: GitFileChange, side: RowSide) => void
  /** Trailing inline actions (stage/unstage/discard) injected by T17. */
  actions?: React.ReactNode
}

function ChangeRow({ change, side, onOpenDiff, actions }: ChangeRowProps): React.JSX.Element {
  const kind = statusKind(change)
  const letter = statusLetter(change)
  const name = baseName(change.path)
  const dir = splitDir(dirName(change.path))
  const meaning = kindMeaning(kind)
  const title =
    change.origPath !== undefined
      ? `${change.path} · ${t('git.renamedFrom', change.origPath)}`
      : change.path

  return (
    <div className="wb-scm-row" data-side={side}>
      <button
        type="button"
        className="wb-scm-row-open"
        title={title}
        aria-label={t('git.rowAria', name, meaning)}
        onClick={() => onOpenDiff?.(change, side)}
      >
        <span
          className="wb-scm-glyph"
          data-kind={kind}
          data-staged={side === 'staged' || undefined}
          style={{ color: gitStatusColor(kind) }}
          aria-hidden="true"
        >
          {letter}
        </span>
        <span className="wb-scm-path">
          <span className="wb-scm-path-name">{name}</span>
          {dir.tail && (
            <span className="wb-scm-path-dir">
              {dir.head && <span className="wb-scm-path-dir-head">{dir.head}</span>}
              <span className="wb-scm-path-dir-tail">{dir.tail}</span>
            </span>
          )}
        </span>
      </button>
      {actions && <span className="wb-scm-row-actions">{actions}</span>}
    </div>
  )
}

interface ChangeGroupProps {
  title: string
  changes: GitFileChange[]
  side: RowSide
  onOpenDiff?: (change: GitFileChange, side: RowSide) => void
  /** Group-level header actions (Stage all / Unstage all / Discard all) injected by T17. */
  headerActions?: React.ReactNode
  /** Per-row trailing actions builder injected by T17. */
  renderRowActions?: (change: GitFileChange, side: RowSide) => React.ReactNode
  /** Wraps a row (e.g. in a right-click ContextMenu) — identity when omitted. */
  wrapRow?: (change: GitFileChange, side: RowSide, node: React.ReactNode) => React.ReactNode
}

function ChangeGroup({
  title,
  changes,
  side,
  onOpenDiff,
  headerActions,
  renderRowActions,
  wrapRow
}: ChangeGroupProps): React.JSX.Element | null {
  if (changes.length === 0) return null
  const shown = changes.slice(0, MAX_ROWS_PER_GROUP)
  const overflow = changes.length - shown.length

  return (
    <section className="wb-scm-group" aria-label={title}>
      <header className="wb-scm-group-header">
        <span className="wb-scm-group-title">{title}</span>
        <span className="wb-scm-group-count">{changes.length}</span>
        {headerActions && <span className="wb-scm-group-actions">{headerActions}</span>}
      </header>
      <div className="wb-scm-rows">
        {shown.map((change) => {
          const row = (
            <ChangeRow
              change={change}
              side={side}
              onOpenDiff={onOpenDiff}
              actions={renderRowActions?.(change, side)}
            />
          )
          return (
            <Fragment key={`${side}:${change.path}`}>
              {wrapRow ? wrapRow(change, side, row) : row}
            </Fragment>
          )
        })}
        {overflow > 0 && <div className="wb-scm-more">{t('git.moreChanges', overflow)}</div>}
      </div>
    </section>
  )
}

export interface ChangeGroupsProps {
  groups: GitGroups
  onOpenDiff?: (change: GitFileChange, side: RowSide) => void
  /** T17: builds the group-level action cluster for a given side. */
  renderGroupActions?: (side: RowSide) => React.ReactNode
  /** T17: builds a row's trailing action cluster. */
  renderRowActions?: (change: GitFileChange, side: RowSide) => React.ReactNode
  /** T17: wraps each row in a right-click ContextMenu. */
  wrapRow?: (change: GitFileChange, side: RowSide, node: React.ReactNode) => React.ReactNode
}

/**
 * The VS Code-style grouped change list (GIT-R2): Conflitos de merge / Alterações
 * prontas (staged) / Alterações (unstaged + untracked), each with a count and
 * status-colored rows. A file that is both staged and further edited shows in
 * both Staged and Changes (GIT-R2.6) — `groupChanges` already handles that.
 */
export function ChangeGroups({
  groups,
  onOpenDiff,
  renderGroupActions,
  renderRowActions,
  wrapRow
}: ChangeGroupsProps): React.JSX.Element {
  return (
    <div className="wb-scm-groups">
      <ChangeGroup
        title={t('git.groupConflicts')}
        changes={groups.conflicts}
        side="conflict"
        onOpenDiff={onOpenDiff}
        headerActions={renderGroupActions?.('conflict')}
        renderRowActions={renderRowActions}
        wrapRow={wrapRow}
      />
      <ChangeGroup
        title={t('git.groupStaged')}
        changes={groups.staged}
        side="staged"
        onOpenDiff={onOpenDiff}
        headerActions={renderGroupActions?.('staged')}
        renderRowActions={renderRowActions}
        wrapRow={wrapRow}
      />
      <ChangeGroup
        title={t('git.groupChanges')}
        changes={groups.unstaged}
        side="unstaged"
        onOpenDiff={onOpenDiff}
        headerActions={renderGroupActions?.('unstaged')}
        renderRowActions={renderRowActions}
        wrapRow={wrapRow}
      />
    </div>
  )
}

export type { RowSide }
