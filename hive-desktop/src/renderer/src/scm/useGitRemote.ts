import { useCallback, useState } from 'react'
import { t } from '../i18n'
import type { GitStore } from './useGit'

/** The outcome of a git remote op, surfaced as a toast (GIT-R7.6 / G3). */
export interface GitOpResult {
  type: 'success' | 'error'
  message: string
  /** Raw git stderr for the error's "Detalhes" disclosure (never swallowed, D-GIT-1). */
  detail?: string
}

/** Toast-wrapped remote git ops + the op-result toast state. */
export interface GitRemote {
  result: GitOpResult | null
  clear: () => void
  fetch: () => void
  pull: () => void
  push: () => void
  /** Sync (pull-then-push) when there's an upstream, else publish the branch (GIT-R7.3). */
  sync: () => void
}

/**
 * Binds the remote git ops (fetch/pull/push/sync/publish) to toast feedback
 * (GIT-R7.6): each runs the store action (which drives the status-bar busy
 * label) and reports a success toast, or — on a `GitBridgeError` crossing IPC
 * — an error toast carrying git's verbatim `stderr` behind a "Detalhes"
 * disclosure (G3, D-GIT-1: git's real message, never swallowed, never an
 * in-app password prompt). The upstream/publish decision lives here so callers
 * (status-bar pill, SCM header overflow) share one behavior.
 */
export function useGitRemote(git: GitStore): GitRemote {
  const [result, setResult] = useState<GitOpResult | null>(null)

  const run = useCallback(async (op: Promise<unknown>, successMessage: string): Promise<void> => {
    try {
      await op
      setResult({ type: 'success', message: successMessage })
    } catch (err) {
      // GitBridgeError is constructed in the preload realm, so `instanceof`
      // won't match here — read its stderr structurally instead.
      const stderr = (err as { stderr?: string }).stderr
      setResult({ type: 'error', message: t('git.opFailed'), detail: stderr })
    }
  }, [])

  const clear = useCallback(() => setResult(null), [])
  const fetch = (): void => void run(git.fetch(), t('git.toastFetchOk'))
  const pull = (): void => void run(git.pull(), t('git.toastPullOk'))
  const push = (): void => void run(git.push(), t('git.toastPushOk'))
  const sync = (): void => {
    if (git.status?.upstream) void run(git.sync(), t('git.toastSyncOk'))
    else void run(git.publish(), t('git.toastPublishOk'))
  }

  return { result, clear, fetch, pull, push, sync }
}
