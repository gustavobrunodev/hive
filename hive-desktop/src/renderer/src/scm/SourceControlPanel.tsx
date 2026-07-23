import { Button } from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import {
  AlertTriangleIcon,
  BranchIcon,
  CheckCircleIcon,
  RefreshIcon,
  SourceControlIcon
} from '../ui/icons'
import { ChangeGroups, type RowSide } from './ChangeGroups'
import { changeCount, groupChanges, type GitFileChange } from './gitStatus'
import { useGit } from './useGit'

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

/** The panel header: the current branch chip + a refresh affordance (overflow ops land here in later tasks). */
function ScmHeader({
  branch,
  detached,
  onRefresh
}: {
  branch: string | null
  detached: boolean
  onRefresh: () => void
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
        <IconButton label={t('git.refreshLabel')} onClick={onRefresh}>
          <RefreshIcon size={15} />
        </IconButton>
      </span>
    </div>
  )
}

export interface SourceControlPanelProps {
  /** Opens a change's diff in the editor pane (wired in T20). */
  onOpenDiff?: (change: GitFileChange, side: RowSide) => void
  /** T17: builds the group-level action cluster. */
  renderGroupActions?: (side: RowSide) => React.ReactNode
  /** T17: builds a row's trailing action cluster. */
  renderRowActions?: (change: GitFileChange, side: RowSide) => React.ReactNode
  /** T18: the inline commit box, rendered above the change list when the repo is dirty-or-clean. */
  commitBox?: React.ReactNode
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
  renderGroupActions,
  renderRowActions,
  commitBox
}: SourceControlPanelProps): React.JSX.Element {
  const git = useGit()

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

  const groups = groupChanges(git.status)
  const count = changeCount(git.status)
  const branch = git.status?.branch ?? null
  const detached = git.status?.detached ?? false

  return (
    <div className="wb-scm">
      <ScmHeader branch={branch} detached={detached} onRefresh={git.refresh} />
      {commitBox}
      {count === 0 ? (
        <ScmEmpty
          icon={<CheckCircleIcon size={22} />}
          title={t('git.emptyCleanTitle')}
          description={
            branch ? t('git.emptyCleanDescription', branch) : t('git.emptyCleanDescriptionDetached')
          }
        />
      ) : (
        <div className="wb-scm-scroll">
          <ChangeGroups
            groups={groups}
            onOpenDiff={onOpenDiff}
            renderGroupActions={renderGroupActions}
            renderRowActions={renderRowActions}
          />
        </div>
      )}
    </div>
  )
}
