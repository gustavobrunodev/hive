import { useCallback, useState } from 'react'
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SyncIcon
} from '../ui/icons'
import { ChangeGroups, type RowSide } from './ChangeGroups'
import { CommitBox } from './CommitBox'
import { HistoryPanel } from './HistoryPanel'
import type { GitRemote } from './useGitRemote'
import { DiscardDialog, GroupActions, RowActions } from './ScmActions'
import { changeCount, groupChanges, type GitFileChange, type GitGroups } from './gitStatus'
import { useGit } from './useGit'

/** Copies text to the clipboard, tolerating environments without the async Clipboard API. */
function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text)
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

/** The panel header: the current branch chip, a refresh affordance, and the remote-ops overflow (GIT-R7). */
function ScmHeader({
  branch,
  detached,
  onRefresh,
  remote,
  showHistory,
  onToggleHistory
}: {
  branch: string | null
  detached: boolean
  onRefresh: () => void
  remote?: GitRemote
  showHistory: boolean
  onToggleHistory: () => void
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
        {remote && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t('git.moreActions')}>
                <MoreIcon size={15} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={remote.sync}>
                <SyncIcon size={14} /> {t('git.syncAction')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={remote.fetch}>{t('git.fetchAction')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={remote.pull}>{t('git.pullAction')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={remote.push}>{t('git.pushAction')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
  remote
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

  if (git.repo.gitMissing) {
    return (
      <ScmEmpty
        icon={<AlertTriangleIcon size={22} />}
        title={t('git.gitMissingTitle')}
        description={t('git.gitMissingDescription')}
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
        remote={remote}
        showHistory={showHistory}
        onToggleHistory={toggleHistory}
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
          <CommitBox />
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
