import { useCallback, useEffect, useState } from 'react'

/**
 * Non-component shared logic for the rich file viewers — the async-load hook
 * and the zoom vocabulary. Kept JSX-free (and separate from the shared
 * component chrome in `docViewerShared.tsx`) so React Fast Refresh stays happy:
 * a module that mixes component and non-component exports can't hot-reload.
 */

export type AsyncStatus = 'loading' | 'error' | 'ready'

interface AsyncDocumentState<T> {
  status: AsyncStatus
  data: T | null
  reload: () => void
}

/**
 * Runs `load` on mount and whenever `key` changes (the workspace-relative
 * path — a new file must refetch), tracking loading/error/ready and exposing a
 * `reload`. Cancellation via a mounted flag so a resolve that lands after a
 * fast path-switch or unmount can't overwrite the newer state.
 */
export function useAsyncDocument<T>(load: () => Promise<T>, key: string): AsyncDocumentState<T> {
  const [state, setState] = useState<{ status: AsyncStatus; data: T | null }>({
    status: 'loading',
    data: null
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const run = async (): Promise<void> => {
      setState({ status: 'loading', data: null })
      try {
        const data = await load()
        if (active) setState({ status: 'ready', data })
      } catch {
        if (active) setState({ status: 'error', data: null })
      }
    }
    void run()
    return () => {
      active = false
    }
    // `load` is recreated per render by callers; `key`+`attempt` are the real
    // triggers (path change / manual retry), so the exhaustive-deps lint is
    // intentionally narrowed to them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null })
    setAttempt((n) => n + 1)
  }, [])

  return { status: state.status, data: state.data, reload: retry }
}

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 5
const ZOOM_STEP = 0.25

/** Clamps a zoom factor to the viewer's supported range. */
export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/** Steps a zoom factor up/down by one increment, clamped. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(Math.round((zoom + direction * ZOOM_STEP) * 100) / 100)
}
