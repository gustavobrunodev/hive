import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhisperModelId, WhisperVariant } from '../secondBrain/whisper/useWhisper'

/** One model's in-flight (or just-failed) download. */
export interface DownloadState {
  /** 0–100, or `null` before the first progress event lands. */
  pct: number | null
  failed: boolean
}

export interface ModelDownloads {
  /** Keyed by model id; absent means "not downloading and not failed". */
  states: Record<string, DownloadState>
  start: (id: WhisperModelId) => void
  /** Aborts an in-flight download, or dismisses a failed one. */
  cancel: (id: WhisperModelId) => void
}

/**
 * Download bookkeeping for the catalog rows (SB-R7.2), lifted out of the view.
 *
 * Three things here are not obvious from the bridge's shape:
 *
 * - **A failure has to survive the stream ending.** `downloadModel` reports
 *   `error` and then goes quiet; a row that dropped its progress state on any
 *   terminal event would make a failed 900 MB download look exactly like one
 *   that was never started. The state is kept and flagged until the user
 *   retries or dismisses it.
 * - **Unsubscribing is the cancel.** There is no `whisper:download:cancel` —
 *   the preload's teardown sends `whisper:download:stop`. So holding the
 *   unsubscribe handle *is* holding the cancel, and every one of them has to be
 *   released on unmount, or a closed sheet leaves a stream running in main.
 * - **The precision is read at click time, not at mount.** `variant` comes from
 *   a WebGPU probe that resolves *after* the first render, so capturing it in
 *   the callback's closure would fetch fp32 on a machine that had already been
 *   measured as WebGPU-capable.
 */
export function useModelDownloads(variant: WhisperVariant, onFinished: () => void): ModelDownloads {
  const [states, setStates] = useState<Record<string, DownloadState>>({})
  const handles = useRef(new Map<string, () => void>())
  // Both read at call time so `start` can stay identity-stable: a callback that
  // changed every render would tear down and re-subscribe a live download.
  // Written in an effect, never during render — the React compiler's
  // "Cannot access refs during render" rule, and the reason it exists is that a
  // render can be thrown away, which would leave the ref describing a commit
  // that never happened.
  const variantRef = useRef(variant)
  const finishedRef = useRef(onFinished)
  useEffect(() => {
    variantRef.current = variant
    finishedRef.current = onFinished
  }, [variant, onFinished])

  useEffect(() => {
    const live = handles.current
    return () => {
      for (const off of live.values()) off()
      live.clear()
    }
  }, [])

  const forget = useCallback((id: WhisperModelId) => {
    setStates((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  const start = useCallback((id: WhisperModelId) => {
    handles.current.get(id)?.()
    setStates((current) => ({ ...current, [id]: { pct: null, failed: false } }))

    // The terminal event can arrive before `downloadModel` returns (an
    // already-complete download resolves synchronously), so teardown goes
    // through a flag rather than a handle still in its temporal dead zone —
    // the shape `useWhisper.ensureDownloaded` already uses.
    const handle: { off?: () => void } = {}
    let settled = false
    const teardown = (): void => {
      settled = true
      handles.current.delete(id)
      handle.off?.()
    }

    handle.off = window.hive.whisper.downloadModel(id, variantRef.current, (event) => {
      if (event.type === 'progress') {
        const pct = event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0
        setStates((current) => ({ ...current, [id]: { pct, failed: false } }))
        return
      }
      teardown()
      if (event.type === 'error') {
        setStates((current) => ({ ...current, [id]: { pct: null, failed: true } }))
        return
      }
      setStates((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      finishedRef.current()
    })

    if (settled) handle.off()
    else handles.current.set(id, handle.off)
  }, [])

  const cancel = useCallback(
    (id: WhisperModelId) => {
      handles.current.get(id)?.()
      handles.current.delete(id)
      forget(id)
    },
    [forget]
  )

  return { states, start, cancel }
}
