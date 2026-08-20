import { useCallback, useEffect, useState } from 'react'
import type { WhisperModelId } from './useWhisper'

/** The resolved preference as the bridge returns it (never imports `src/main/*`). */
export type WhisperPreference = Awaited<ReturnType<Window['hive']['whisper']['preference']>>

export interface WhisperPreferenceState {
  /**
   * The resolved preference, or `null` until main has answered.
   *
   * `null` is not "no model": it is "we have not asked yet", and the UI shows a
   * skeleton for it rather than a fallback id. Rendering `base` while the probe
   * is still running would state a fact that may be about to change, and a
   * label that changes under the reader is worse than a label that arrives.
   */
  preference: WhisperPreference | null
  /** Pins a model by id. */
  select: (id: WhisperModelId) => void
  /** Hands the choice back to the hardware probe. */
  reset: () => void
}

/**
 * The model transcription runs with (SB-R7.4).
 *
 * The decision itself lives in main — it needs `os` and `app.getGPUInfo`, and
 * more importantly it must be the *same* answer for every surface that
 * transcribes. This hook is only the subscription: it reads the resolved
 * preference on mount and writes the user's override back, so nothing in the
 * renderer re-derives the rule or caches a stale copy of it.
 */
export function useWhisperPreference(active = true): WhisperPreferenceState {
  const [preference, setPreference] = useState<WhisperPreference | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void window.hive.whisper.preference().then((next) => {
      if (!cancelled) setPreference(next)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  // The write returns the newly-resolved preference rather than the caller
  // guessing what it became — pinning a model that is no longer on disk hands
  // the decision straight back to the probe, and only main can know that.
  const apply = useCallback((id: WhisperModelId | null) => {
    void window.hive.whisper.setPreferredModel(id).then(setPreference)
  }, [])

  return {
    preference,
    select: useCallback((id: WhisperModelId) => apply(id), [apply]),
    reset: useCallback(() => apply(null), [apply])
  }
}
