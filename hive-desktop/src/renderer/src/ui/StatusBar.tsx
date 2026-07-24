import { Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { changeCount } from '../scm/gitStatus'
import { useGit } from '../scm/useGit'
import { ArrowDownIcon, ArrowUpIcon, BranchIcon, CheckCircleIcon, SourceControlIcon } from './icons'

export interface StatusBarProps {
  /** Opens the branch quick-pick (wired in T22). */
  onBranch: () => void
  /** Fetch-then-push sync, or publish when there's no upstream (wired in T23). */
  onSync: () => void
  /** Opens the Source Control view. */
  onChanges: () => void
  /** `git init` for a non-repo workspace. */
  onInit: () => void
}

/**
 * The persistent bottom status bar (git-management §6.2, GIT-R12) — the
 * always-present anchor that makes git ambient. Sits on the cooler `--surface`
 * layer, quiet until hovered. Left cluster: branch pill (→ picker), ↑↓ sync
 * (→ sync, spinner while an op is in flight), changes count (→ SCM view). A
 * non-repo workspace shows a single "Inicializar repositório" affordance
 * (GIT-R12.3); a missing git binary shows nothing (the SCM view teaches it).
 * Reads state from the shared `useGit` store.
 */
/** The sync/publish cluster's inner content: a busy spinner, ↑↓ counts, or a publish label. */
function SyncContent({
  busy,
  hasUpstream,
  ahead,
  behind
}: {
  busy: string | null
  hasUpstream: boolean
  ahead: number
  behind: number
}): React.JSX.Element {
  if (busy) {
    return (
      <span className="wb-status-busy">
        <Spinner size={12} />
        <span>{t('git.busyLabel', busy)}</span>
      </span>
    )
  }
  if (hasUpstream) {
    return (
      <span className="wb-status-sync">
        <ArrowUpIcon size={12} />
        {ahead}
        <ArrowDownIcon size={12} />
        {behind}
      </span>
    )
  }
  return <span className="wb-status-sync">{t('git.publishBranch')}</span>
}

/** The three clusters shown for a repo workspace. */
function RepoClusters({
  onBranch,
  onSync,
  onChanges
}: Pick<StatusBarProps, 'onBranch' | 'onSync' | 'onChanges'>): React.JSX.Element {
  const git = useGit()
  const status = git.status
  const branch = status?.branch ?? null
  const detached = status?.detached ?? false
  const branchLabel = detached || !branch ? t('git.detachedHead') : branch
  const hasUpstream = !!status?.upstream
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const count = changeCount(status)
  const syncLabel = hasUpstream
    ? t('git.statusSyncAria', ahead, behind)
    : t('git.statusPublishAria')
  const changesLabel = count > 0 ? t('git.statusChangesAria', count) : t('git.statusNoChangesAria')

  return (
    <>
      <button
        type="button"
        className="wb-status-item"
        aria-label={t('git.statusBranchAria', branchLabel)}
        title={branchLabel}
        onClick={onBranch}
      >
        <BranchIcon size={13} />
        <span className="wb-status-branch">{branchLabel}</span>
      </button>
      <button
        type="button"
        className="wb-status-item"
        aria-label={syncLabel}
        title={syncLabel}
        onClick={onSync}
      >
        <SyncContent busy={git.busy} hasUpstream={hasUpstream} ahead={ahead} behind={behind} />
      </button>
      <button
        type="button"
        className="wb-status-item"
        aria-label={changesLabel}
        title={changesLabel}
        onClick={onChanges}
      >
        <CheckCircleIcon size={13} />
        <span>{count}</span>
      </button>
    </>
  )
}

export function StatusBar({
  onBranch,
  onSync,
  onChanges,
  onInit
}: StatusBarProps): React.JSX.Element | null {
  const git = useGit()

  if (git.repo.gitMissing) return null

  return (
    <footer className="wb-statusbar" aria-label={t('git.statusBarLabel')}>
      {git.repo.isRepo ? (
        <RepoClusters onBranch={onBranch} onSync={onSync} onChanges={onChanges} />
      ) : (
        <button
          type="button"
          className="wb-status-item"
          aria-label={t('git.statusInitAria')}
          title={t('git.statusInit')}
          onClick={onInit}
        >
          <SourceControlIcon size={13} />
          <span>{t('git.statusInit')}</span>
        </button>
      )}
    </footer>
  )
}
