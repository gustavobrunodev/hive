import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import {
  AlertTriangleIcon,
  BranchIcon,
  CheckCircleIcon,
  HistoryIcon,
  MoreIcon,
  RefreshIcon,
  SourceControlIcon,
  SyncIcon,
  TerminalIcon
} from '../ui/icons'
import { ChangeGroups, type RowSide } from './ChangeGroups'
import { CommitBox } from './CommitBox'
import { HistoryPanel } from './HistoryPanel'
import { StashPanel } from './StashPanel'
import type { GitRemote } from './useGitRemote'
import { DiscardDialog, GroupActions, RowActions } from './ScmActions'
import {
  changeCount,
  groupChanges,
  type GitFileChange,
  type GitGroups,
  type GitStatus
} from './gitStatus'
import { useGit } from './useGit'
import { copyText } from '../ui/clipboard'

/** Copies text to the clipboard through the app's own bridge (see `ui/clipboard.ts` for why not `navigator.clipboard`). */
function copyToClipboard(text: string): void {
  void copyText(text)
}

/** A teaching empty state (icon + title + description + optional action) — never a blank pane (design.md §7). */
function ScmEmpty({
  icon,
  title,
  description,
  action
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="wb-scm-empty">
      <span className="wb-scm-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="wb-scm-empty-title">{title}</p>
      <p className="wb-scm-empty-desc">{description}</p>
      {action && <div className="wb-scm-empty-action">{action}</div>}
    </div>
  )
}

/**
 * The header's overflow menu — checkout, the remote group, and the way into
 * the git command console. Its own component purely so `ScmHeader` stays
 * under the lint's complexity budget: three independently-optional groups is
 * three branches, and the header already had its own.
 */
function ScmOverflowMenu({
  onCheckout,
  remote,
  onShowLogs
}: {
  onCheckout?: () => void
  remote?: GitRemote
  onShowLogs?: () => void
}): React.JSX.Element | null {
  // The menu is not gated on `remote`: checkout is a local operation, and a
  // repo without a remote still has branches to move between. Only the remote
  // group below is conditional.
  if (!onCheckout && !remote && !onShowLogs) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t('git.moreActions')}>
          <MoreIcon size={15} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onCheckout && (
          <DropdownMenuItem onSelect={onCheckout}>
            <BranchIcon size={14} /> {t('git.checkoutAction')}
          </DropdownMenuItem>
        )}
        {onCheckout && remote && <DropdownMenuSeparator />}
        {remote && (
          <>
            <DropdownMenuItem onSelect={remote.sync}>
              <SyncIcon size={14} /> {t('git.syncAction')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={remote.fetch}>{t('git.fetchAction')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={remote.pull}>{t('git.pullAction')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={remote.push}>{t('git.pushAction')}</DropdownMenuItem>
          </>
        )}
        {/* git-logs: last in the menu and behind its own rule, because it is
            the only entry that acts on the *app* rather than on the
            repository — you reach for it when one of the commands above did
            something you did not expect. */}
        {onShowLogs && (
          <>
            {(onCheckout || remote) && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onShowLogs}>
              <TerminalIcon size={14} /> {t('git.logsAction')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The panel header: the current branch chip, a refresh affordance, and the overflow menu — checkout + remote ops (GIT-R6/R7). */
function ScmHeader({
  branch,
  detached,
  onRefresh,
  onCheckout,
  remote,
  showHistory,
  onToggleHistory,
  onShowLogs
}: {
  branch: string | null
  detached: boolean
  onRefresh: () => void
  onCheckout?: () => void
  remote?: GitRemote
  showHistory: boolean
  onToggleHistory: () => void
  onShowLogs?: () => void
}): React.JSX.Element {
  const label = detached || !branch ? t('git.detachedHead') : branch
  return (
    <div className="wb-scm-header">
      <span
        className="wb-scm-branch"
        data-detached={detached || undefined}
        title={label}
        aria-label={t('git.branchAria', label)}
      >
        <BranchIcon size={14} />
        <span className="wb-scm-branch-name">{label}</span>
      </span>
      <span className="wb-scm-header-actions">
        <IconButton
          label={showHistory ? t('git.changesToggle') : t('git.historyToggle')}
          data-active={showHistory || undefined}
          onClick={onToggleHistory}
        >
          <HistoryIcon size={15} />
        </IconButton>
        <IconButton label={t('git.refreshLabel')} onClick={onRefresh}>
          <RefreshIcon size={15} />
        </IconButton>
        <ScmOverflowMenu onCheckout={onCheckout} remote={remote} onShowLogs={onShowLogs} />
      </span>
    </div>
  )
}

export interface SourceControlPanelProps {
  /** Opens a change's diff in the editor pane (wired in T20). */
  onOpenDiff?: (change: GitFileChange, side: RowSide) => void
  /** Opens a commit's diff in the editor pane (GIT-R8.2). */
  onOpenCommit?: (hash: string, label: string) => void
  /** Toast-wrapped remote ops for the header overflow menu (GIT-R7). */
  remote?: GitRemote
  /**
   * Opens the branch quick-pick — the "Trocar de branch (checkout)…" command
   * in the header overflow (GIT-R6). Owned by `WorkUI` because a checkout has
   * to pass the unsaved-work guard first (GIT-R6.3), exactly like the status
   * bar's branch pill; the panel only offers the command.
   */
  onCheckout?: () => void
  /**
   * git-logs: opens the command console (the dock lives in `WorkUI`, like the
   * MCP one, because two docks stacked under the work area would leave nothing
   * of it — only one can be open at a time and the parent is what knows that).
   */
  onShowLogs?: () => void
}

/**
 * Shown when `status` hit its entry cap: the change list is a prefix, not the
 * repo. Said out loud, with the way out (a `.gitignore`), because a silently
 * clipped list is a lie about what "Alterações" contains. Its own component so
 * the panel stays inside the lint's complexity budget.
 */
function TruncatedNotice({
  status,
  count
}: {
  status: GitStatus | null
  count: number
}): React.JSX.Element | null {
  if (!status?.truncated) return null
  return (
    <Alert
      className="wb-scm-notice"
      variant="warning"
      icon={<AlertTriangleIcon size={16} />}
      title={t('git.truncatedTitle', count)}
    >
      {t('git.truncatedDescription')}
    </Alert>
  )
}

/** The paths behind a side's group, for the group-level stage/unstage/discard-all actions. */
function sidePaths(groups: GitGroups, side: RowSide): GitFileChange[] {
  if (side === 'staged') return groups.staged
  if (side === 'conflict') return groups.conflicts
  return groups.unstaged
}

/**
 * The Source Control view body (git-management, design.md §5.2) — the rail
 * pane's content when `activeView === 'scm'`. Reads the shared `useGit` store
 * and renders one of: a git-missing state, an initialize-repo state, a calm
 * "no changes" state naming the branch, or the branch header + grouped change
 * list (GIT-R1/R2). Row/commit/diff wiring arrives in T17/T18/T20 via props.
 */
export function SourceControlPanel({
  onOpenDiff,
  onOpenCommit,
  remote,
  onCheckout,
  onShowLogs
}: SourceControlPanelProps): React.JSX.Element {
  const git = useGit()
  // The changes queued behind the discard confirmation (GIT-R3.3); null = closed.
  const [discardTarget, setDiscardTarget] = useState<GitFileChange[] | null>(null)
  // History timeline vs the change list, and an optional single-file scope (GIT-R8).
  const [showHistory, setShowHistory] = useState(false)
  const [historyFile, setHistoryFile] = useState<string | null>(null)
  const openFileHistory = useCallback((path: string) => {
    setHistoryFile(path)
    setShowHistory(true)
  }, [])

  const groups = groupChanges(git.status)

  const stage = useCallback((change: GitFileChange) => void git.stage([change.path]), [git])
  const unstage = useCallback((change: GitFileChange) => void git.unstage([change.path]), [git])
  const requestDiscard = useCallback((change: GitFileChange) => setDiscardTarget([change]), [])
  const confirmDiscard = useCallback(() => {
    if (discardTarget) void git.discard(discardTarget.map((c) => c.path))
    setDiscardTarget(null)
  }, [discardTarget, git])

  const renderRowActions = useCallback(
    (change: GitFileChange, side: RowSide) => (
      <RowActions
        change={change}
        side={side}
        onStage={stage}
        onUnstage={unstage}
        onDiscard={requestDiscard}
      />
    ),
    [stage, unstage, requestDiscard]
  )

  const renderGroupActions = useCallback(
    (side: RowSide) => (
      <GroupActions
        side={side}
        onStageAll={() => void git.stage(sidePaths(groups, side).map((c) => c.path))}
        onUnstageAll={() => void git.unstage(sidePaths(groups, side).map((c) => c.path))}
        onDiscardAll={() => setDiscardTarget(sidePaths(groups, side))}
      />
    ),
    [git, groups]
  )

  const wrapRow = useCallback(
    (change: GitFileChange, side: RowSide, node: React.ReactNode) => (
      <ContextMenu>
        <ContextMenuTrigger asChild>{node}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onOpenDiff?.(change, side)}>
            {t('git.openDiff')}
          </ContextMenuItem>
          {side === 'staged' ? (
            <ContextMenuItem onSelect={() => unstage(change)}>{t('git.unstage')}</ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => stage(change)}>{t('git.stage')}</ContextMenuItem>
          )}
          {side === 'unstaged' && (
            <ContextMenuItem onSelect={() => requestDiscard(change)}>
              {t('git.discard')}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => openFileHistory(change.path)}>
            {t('git.viewHistory')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => copyToClipboard(change.path)}>
            {t('git.copyPath')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ),
    [onOpenDiff, stage, unstage, requestDiscard, openFileHistory]
  )

  // git-logs: the console is offered here too, and this is the state that most
  // needs it — "o git não está instalado" is a claim about the machine, and
  // the journal is where its evidence (a command that never spawned) is.
  if (git.repo.gitMissing) {
    return (
      <ScmEmpty
        icon={<AlertTriangleIcon size={22} />}
        title={t('git.gitMissingTitle')}
        description={t('git.gitMissingDescription')}
        action={
          onShowLogs && (
            <Button className="wb-btn" onClick={onShowLogs}>
              {t('git.logsAction')}
            </Button>
          )
        }
      />
    )
  }

  if (!git.repo.isRepo) {
    return (
      <ScmEmpty
        icon={<SourceControlIcon size={22} />}
        title={t('git.notARepoTitle')}
        description={t('git.notARepoDescription')}
        action={
          <Button className="wb-btn hds-btn-primary" onClick={() => void git.init()}>
            {t('git.initRepo')}
          </Button>
        }
      />
    )
  }

  const count = changeCount(git.status)
  const branch = git.status?.branch ?? null
  const detached = git.status?.detached ?? false

  const toggleHistory = (): void => {
    setShowHistory((prev) => !prev)
    setHistoryFile(null)
  }

  return (
    <div className="wb-scm">
      <ScmHeader
        branch={branch}
        detached={detached}
        onRefresh={git.refresh}
        onCheckout={onCheckout}
        remote={remote}
        showHistory={showHistory}
        onToggleHistory={toggleHistory}
        onShowLogs={onShowLogs}
      />
      {showHistory ? (
        <div className="wb-scm-scroll">
          <HistoryPanel
            onOpenCommit={(hash, label) => onOpenCommit?.(hash, label)}
            file={historyFile ?? undefined}
            onClearScope={() => setHistoryFile(null)}
          />
        </div>
      ) : (
        <>
          {git.status?.mergeInProgress && (
            <div className="wb-merge-banner" role="status">
              <span className="wb-merge-banner-label">{t('git.mergeInProgress')}</span>
              <span className="wb-merge-banner-actions">
                <Button className="wb-btn" onClick={() => void git.mergeAbort()}>
                  {t('git.mergeAbort')}
                </Button>
                <Button
                  className="wb-btn hds-btn-primary"
                  disabled={groups.conflicts.length > 0}
                  onClick={() => void git.mergeContinue()}
                >
                  {t('git.mergeContinue')}
                </Button>
              </span>
            </div>
          )}
          <CommitBox />
          <TruncatedNotice status={git.status} count={count} />
          {count === 0 ? (
            <ScmEmpty
              icon={<CheckCircleIcon size={22} />}
              title={t('git.emptyCleanTitle')}
              description={
                branch
                  ? t('git.emptyCleanDescription', branch)
                  : t('git.emptyCleanDescriptionDetached')
              }
            />
          ) : (
            <div className="wb-scm-scroll">
              <ChangeGroups
                groups={groups}
                onOpenDiff={onOpenDiff}
                renderGroupActions={renderGroupActions}
                renderRowActions={renderRowActions}
                wrapRow={wrapRow}
              />
            </div>
          )}
          <StashPanel />
        </>
      )}
      <DiscardDialog
        target={discardTarget}
        onCancel={() => setDiscardTarget(null)}
        onConfirm={confirmDiscard}
      />
    </div>
  )
}
