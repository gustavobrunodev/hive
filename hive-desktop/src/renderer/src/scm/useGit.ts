import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { buildDecorations, type GitDecoration, type GitStatus } from './gitStatus'

/** Debounce for coalescing refresh triggers (fs events / git:changed / focus) — design.md §3.3/§8. */
const REFRESH_DEBOUNCE_MS = 250

/**
 * The single git-state store for the active workspace (design.md §5.3),
 * consumed by `SourceControlPanel`, `StatusBar`, the explorer tree
 * (decorations) and the editor gutter. `busy` holds a semantic op id
 * (`'commit'`, `'sync'`, …) the status bar maps to i18n; it resets to `null`
 * when the op settles.
 */
export interface GitStore {
  repo: { isRepo: boolean; gitMissing: boolean }
  status: GitStatus | null
  busy: string | null
  decorations: Map<string, GitDecoration>
  /** Debounced status re-run (coalesces bursts of fs/git events). */
  refresh: () => void
  init: () => Promise<void>
  stage: (paths: string[]) => Promise<void>
  unstage: (paths: string[]) => Promise<void>
  discard: (paths: string[]) => Promise<void>
  commit: (message: string, opts?: { amend?: boolean; stageAll?: boolean }) => Promise<void>
}

/**
 * Owns git state for `workspace`. Mounted once in `WorkUI` (like
 * `useUpdateFlow`) and shared via `GitProvider`. Resets and re-detects on every
 * workspace change (GIT-R1.3). Refresh is debounced + coalesced across the
 * three triggers — never a busy poll.
 */
/** Git state tagged with the workspace it belongs to, so a stale workspace's state is filtered out by pure derivation (no reset effect needed). */
interface TaggedGitState {
  ws: string
  repo: { isRepo: boolean; gitMissing: boolean }
  status: GitStatus | null
}

export function useGitStore(workspace: string): GitStore {
  const [state, setState] = useState<TaggedGitState>({
    ws: workspace,
    repo: { isRepo: false, gitMissing: false },
    status: null
  })
  const [busy, setBusy] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `ws` is threaded in explicitly (not read from a render-mutated ref). A
  // response that lands after a workspace switch simply writes state tagged
  // with the old `ws`, which the derivation below filters out — so no
  // mid-flight guard is needed.
  const runRefresh = useCallback(async (ws: string) => {
    const detected = await window.hive.git.detect(ws)
    if (!detected.isRepo) {
      setState({ ws, repo: { isRepo: false, gitMissing: detected.gitMissing }, status: null })
      return
    }
    const next = await window.hive.git.status(ws)
    setState({ ws, repo: { isRepo: true, gitMissing: false }, status: next })
  }, [])

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void runRefresh(workspace)
    }, REFRESH_DEBOUNCE_MS)
  }, [workspace, runRefresh])

  // Eager initial load / re-detect on workspace change (GIT-R1.3). Deferred a
  // microtask so the state write happens outside the effect body (the eager
  // path shouldn't wait for the 250 ms debounce, but also shouldn't setState
  // synchronously inside the effect).
  useEffect(() => {
    queueMicrotask(() => void runRefresh(workspace))
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [workspace, runRefresh])

  // Refresh triggers: own mutations (git:changed), external fs writes
  // (agent/editor), and window focus — all funneled through the debounce.
  useEffect(() => {
    const offGit = window.hive.git.onChanged(() => refresh())
    const offFs = window.hive.watchWorkspace(workspace, () => refresh())
    const onFocus = (): void => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      offGit()
      offFs()
      window.removeEventListener('focus', onFocus)
    }
  }, [workspace, refresh])

  // Runs a mutating action under an optional busy label, then settles state
  // immediately (git:changed also fires, but the debounced path shouldn't be
  // the only route to truth after an explicit action).
  const runAction = useCallback(
    async (label: string | null, fn: (ws: string) => Promise<unknown>): Promise<void> => {
      if (label) setBusy(label)
      try {
        await fn(workspace)
      } finally {
        if (label) setBusy(null)
      }
      await runRefresh(workspace)
    },
    [workspace, runRefresh]
  )

  const init = useCallback(() => runAction(null, (ws) => window.hive.git.init(ws)), [runAction])
  const stage = useCallback(
    (paths: string[]) => runAction(null, (ws) => window.hive.git.stage(ws, paths)),
    [runAction]
  )
  const unstage = useCallback(
    (paths: string[]) => runAction(null, (ws) => window.hive.git.unstage(ws, paths)),
    [runAction]
  )
  const discard = useCallback(
    (paths: string[]) => runAction(null, (ws) => window.hive.git.discard(ws, paths)),
    [runAction]
  )
  const commit = useCallback(
    (message: string, opts?: { amend?: boolean; stageAll?: boolean }) =>
      runAction('commit', (ws) => window.hive.git.commit(ws, message, opts)),
    [runAction]
  )

  // Pure derivation: state from a since-switched workspace reads as an empty,
  // not-yet-detected repo until `runRefresh` lands the new workspace's state
  // (GIT-R1.3) — no reset effect, no setState during render.
  const matches = state.ws === workspace
  const repo = matches ? state.repo : { isRepo: false, gitMissing: false }
  const status = matches ? state.status : null

  const decorations = useMemo(() => buildDecorations(status), [status])

  return { repo, status, busy, decorations, refresh, init, stage, unstage, discard, commit }
}

const GitContext = createContext<GitStore | null>(null)

/** Provides a `GitStore` to the subtree (rail panel, status bar, tree, gutter). */
export function GitProvider({
  store,
  children
}: {
  store: GitStore
  children?: ReactNode
}): React.JSX.Element {
  return createElement(GitContext.Provider, { value: store }, children)
}

/** Reads the git store; throws if used outside a `GitProvider`. */
export function useGit(): GitStore {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within a GitProvider')
  return ctx
}
