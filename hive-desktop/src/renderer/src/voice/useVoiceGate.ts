import { useCallback, useEffect, useRef, useState } from 'react'
import { useWhisperPreference } from '../secondBrain/whisper/useWhisperPreference'
import { useWhisperDownloadEndings } from './useWhisperDownloads'
import type { ModelInfo } from './modelFacts'

type WhisperModelId = ModelInfo['id']

export interface VoiceGate {
  /** The model that would transcribe, or `null` when nothing is installed. */
  model: WhisperModelId | null
  /** True while no model exists — every microphone affordance routes through `guard`. */
  blocked: boolean
  /**
   * Runs `action` now if a model exists; otherwise remembers it, opens the
   * gate, and runs it the moment a model lands **while the gate is still open**.
   */
  guard: (action: () => void) => void
  open: boolean
  /** Closing the gate forgets the remembered intent (see below). */
  setOpen: (open: boolean) => void
}

/**
 * The rule every recording surface follows now that the app ships no weights.
 *
 * One hook rather than two copies because the chat composer and the ingestion
 * sheet had already drifted once on exactly this axis: the composer dictated
 * with a hardcoded model for a whole milestone while the sheet read the real
 * preference. The interesting part is not the boolean, it is the **remembered
 * intent** — a user who presses the microphone is asking to speak, and after a
 * download that request should still be honoured rather than making them press
 * it again.
 *
 * **The memory ends when the dialog does.** If the gate is closed, the intent
 * is dropped: a microphone that opens by itself several minutes later, with no
 * dialog on screen to explain why, is worse than one more click. The completion
 * notice covers that case instead, and it offers the model rather than the
 * recording.
 */
export function useVoiceGate(active = true): VoiceGate {
  const preference = useWhisperPreference(active)
  const model = preference.preference?.id ?? null
  const [open, setOpen] = useState(false)
  const pending = useRef<(() => void) | null>(null)
  const { refresh } = preference

  // A model that lands anywhere — here, the settings sheet, another window —
  // makes this surface usable, so the preference is re-resolved on any ending.
  useWhisperDownloadEndings(
    useCallback(
      (download) => {
        if (download.status === 'done') refresh()
      },
      [refresh]
    )
  )

  useEffect(() => {
    if (!open || model === null) return
    // Named-and-invoked (the repo's `load()` pattern) so the state write is not
    // a bare call in the effect body — `react-hooks/set-state-in-effect`.
    function proceed(): void {
      const action = pending.current
      pending.current = null
      setOpen(false)
      action?.()
    }
    proceed()
  }, [open, model])

  const guard = useCallback(
    (action: () => void) => {
      if (model !== null) {
        action()
        return
      }
      pending.current = action
      setOpen(true)
    },
    [model]
  )

  const changeOpen = useCallback((next: boolean) => {
    if (!next) pending.current = null
    setOpen(next)
  }, [])

  return { model, blocked: model === null, guard, open, setOpen: changeOpen }
}
