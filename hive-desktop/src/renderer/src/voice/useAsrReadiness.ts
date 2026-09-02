import { useCallback, useEffect, useState } from 'react'

/** The readiness answer as the bridge returns it (never imports `src/main/*`). */
export type AsrReadiness = Awaited<ReturnType<Window['hive']['asr']['readiness']>>

export interface AsrReadinessState {
  /**
   * Main's answer, or `null` until it arrives.
   *
   * `null` is not "no model": it is "we have not asked yet". Rendering a
   * fallback during the round trip would state a fact that may be about to
   * change, and a label that changes under the reader is worse than one that
   * arrives.
   */
  readiness: AsrReadiness | null
  /**
   * Deletes the model's bytes, resolving with the readiness that results.
   *
   * It returns the promise rather than swallowing it because the delete can
   * genuinely fail — Windows refuses to unlink a weight file the engine still
   * has open — and a caller that cannot await it has no way to say so. A
   * `void`-returning version looked fine and made the failure branch above it
   * unreachable.
   */
  remove: () => Promise<void>
  /**
   * Re-asks main.
   *
   * Needed because installed-ness changes without this surface doing anything:
   * a download finishing in another window, or the model being deleted from the
   * settings sheet, both make the previous answer wrong.
   */
  refresh: () => void
}

/**
 * Whether the app can transcribe (M29).
 *
 * The descendant of `useWhisperPreference`, which subscribed to "which of ten
 * models is in force, and did the user or the probe choose it". With one model
 * the only live question is whether its bytes are on disk — and that question
 * is load-bearing in exactly the way the old one was: the app ships no weights,
 * so a fresh install has nothing to transcribe with, and every recording
 * surface has to see that in order to *offer the download* rather than open a
 * microphone that can only fail.
 *
 * The answer stays in main because it is a fact about the filesystem, and
 * because it must be the same answer for every surface that records.
 */
export function useAsrReadiness(active = true): AsrReadinessState {
  const [readiness, setReadiness] = useState<AsrReadiness | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void window.hive.asr.readiness().then((next) => {
      if (!cancelled) setReadiness(next)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const refresh = useCallback(() => {
    void window.hive.asr.readiness().then(setReadiness)
  }, [])

  // The delete answers with the readiness that resulted rather than the caller
  // guessing what it became.
  const remove = useCallback(async () => {
    setReadiness(await window.hive.asr.deleteModel())
  }, [])

  return { readiness, remove, refresh }
}

/**
 * Just "can we transcribe", for the surfaces that only need the gate.
 *
 * `false` during the IPC round trip as well as when nothing is installed — no
 * take can start inside that window either, so the two collapse safely.
 */
export function useAsrInstalled(active = true): boolean {
  return useAsrReadiness(active).readiness?.installed ?? false
}
