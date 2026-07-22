import { useCallback, useEffect, useRef, useState } from 'react'
import { reduceUpdateEvent, type UpdateEventIn, type UpdateFlowState } from './updateFlow'

/**
 * How often the app quietly re-checks for updates in the background, on top
 * of the one launch-time check (ND-R2.3). design.md doesn't pin an exact
 * number ("pick something sane... this is a background app, not something
 * that needs aggressive polling") — 45 minutes: often enough that a release
 * published during a long work session is still discovered the same day,
 * rare enough that it's obviously not polling-as-a-service. Sits in the
 * middle of the 30-60 minute range design.md suggests.
 */
const PERIODIC_CHECK_INTERVAL_MS = 45 * 60 * 1000

/** States that count as "a version is pending" for the rail's ambient dot (T12, design.md §5 Tier 1) — everything that isn't "nothing going on" (idle/checking/upToDate). */
const PENDING_STATUSES = new Set<UpdateFlowState['status']>([
  'available',
  'downloading',
  'verifying',
  'downloaded',
  'applying',
  'error'
])

export interface UpdateFlowController {
  /** `AppInfo.version` — `null` before the first `app:info` resolves. */
  currentVersion: string | null
  /** `AppInfo.canApply` (ND-C6). */
  canApply: boolean
  /** The version-block state `UpdateNotice` (and the rail's dot, via `pending`) derive from. */
  state: UpdateFlowState
  /** True whenever a version is pending (T12) — survives `UpdateNotice`'s own session-scoped dismissal; clears on skip (immediately) or on a successful apply (implicitly, via the app restarting into a fresh session). */
  pending: boolean
  /** "Atualizar agora" (`available`) / "Reiniciar e instalar" (`downloaded`) — whichever the current state means. */
  updateNow: () => void
  /** "Agora não" / "Depois" — a no-op here; session dismissal is `UpdateNotice`'s own concern (see the hook's own doc comment). Exposed so every `UpdateNotice` prop has a source. */
  notNow: () => void
  /** "Pular esta versão" (ND-R5.4) — persists the skip and clears the dot immediately. */
  skip: () => void
  /** "Cancelar" (`downloading`). */
  cancel: () => void
  /** "Tentar de novo" (`error`) — an explicit re-check, matching `UpdateCenter`'s identical choice (T13). */
  retry: () => void
  /** "Abrir instalador" (`error`, and `downloaded` when `!canApply`). */
  openInstaller: () => void
}

/**
 * The single shared source of update-flow truth (npm-distribution T14):
 * subscribes to `window.hive.app.onUpdateEvent`, drives the launch-time +
 * periodic silent `checkForUpdates(false)` calls (ND-R2.3), and suppresses
 * the currently-skipped version from ever reaching `state` as `available`
 * (ND-R5.4 — a version newer than the skipped one still comes through
 * normally, since it simply won't equal the skipped one). Never calls
 * `downloadUpdate()` on its own (ND-R5.1) — `updateNow` only ever runs from
 * an explicit `UpdateNotice` click.
 *
 * Session-scoped *dismissal* (ND-R5.3) deliberately isn't tracked here —
 * `UpdateNotice` already owns that itself (component state that survives
 * this hook's parent re-rendering just fine, proven in its own T11 tests);
 * duplicating it here would just be two sources of truth for the same fact.
 *
 * Mount once, high in a tree that survives the whole work-UI session
 * (`WorkUI`) — never inside the onboarding gate chain (`App.tsx`). Its own
 * effects fire only after this component has already mounted, so by
 * construction they can never delay or reorder anything that happened
 * before it (ND-R2.5).
 */
export function useUpdateFlow(): UpdateFlowController {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [canApply, setCanApply] = useState(false)
  const [state, setState] = useState<UpdateFlowState>({ status: 'idle' })
  // Read inside the `onUpdateEvent` subscription's closure (a mount-once
  // effect) — a ref, not state, precisely so `skip()` (called later, from a
  // fresh render) can update the value the closure sees without needing to
  // re-subscribe (a plain state variable read there would freeze at its
  // initial value forever — the exact stale-closure shape UpdateCenter's own
  // `installingSkippedRef`, T13, already worked around the same way).
  const skippedVersionRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.hive.app.info().then((info) => {
      if (cancelled) return
      setCurrentVersion(info.version)
      setCanApply(info.canApply)
      skippedVersionRef.current = info.skippedVersion
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.hive.app.onUpdateEvent((event: UpdateEventIn) => {
      const next = reduceUpdateEvent(event)
      // ND-R5.4: a version equal to the persisted skip is never (re-)announced
      // — silently ignored here rather than surfaced as `available`. A newer
      // version simply won't match and comes through normally.
      if (next.status === 'available' && next.version === skippedVersionRef.current) {
        return
      }
      setState(next)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    // ND-R2.3/ND-R2.5: fires once the work UI itself has already mounted —
    // never inside/blocking App.tsx's onboarding gate chain (`useUpdateFlow`
    // is only ever called from `WorkUI`, which App.tsx renders only once its
    // own gate chain has resolved). `explicit: false` means a dead/offline
    // registry produces nothing visible (ND-R2.4) — never an error toast for
    // a check nobody asked for.
    window.hive.app.checkForUpdates(false)
    const interval = setInterval(() => {
      window.hive.app.checkForUpdates(false)
    }, PERIODIC_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const updateNow = useCallback(() => {
    if (state.status === 'available') void window.hive.app.downloadUpdate()
    else if (state.status === 'downloaded') void window.hive.app.installUpdate()
  }, [state])

  const notNow = useCallback((): void => {}, [])

  const skip = useCallback(() => {
    if (state.status !== 'available') return
    const { version } = state
    void window.hive.app.skipVersion(version)
    skippedVersionRef.current = version
    // Clears the dot immediately (ND-R5.5's "clears... when skipped") rather
    // than waiting for the next check cycle to notice.
    setState({ status: 'idle' })
  }, [state])

  const cancel = useCallback(() => {
    void window.hive.app.cancelUpdate()
  }, [])

  const retry = useCallback(() => {
    void window.hive.app.checkForUpdates(true)
  }, [])

  const openInstaller = useCallback(() => {
    void window.hive.app.revealInstaller()
  }, [])

  return {
    currentVersion,
    canApply,
    state,
    pending: PENDING_STATUSES.has(state.status),
    updateNow,
    notNow,
    skip,
    cancel,
    retry,
    openInstaller
  }
}
