import { useCallback, useEffect, useRef, useState } from 'react'
import { useAsrReadiness } from './useAsrReadiness'
import { useAsrDownloadEndings } from './useAsrDownloads'

export interface VoiceGate {
  /** True once the model is on disk and the microphone can honestly open. */
  ready: boolean
  /**
   * The same fact, **un-collapsed**: `null` means main has not answered yet.
   *
   * `ready` deliberately folds "not asked" into `false`, which is right for
   * gating — no take can start during the round trip either. It is wrong for
   * anything that *says something*: a surface rendering "nenhum modelo baixado"
   * from a pending answer flashes a warning and then retracts it, which is the
   * defect this distinction exists to prevent.
   */
  installed: boolean | null
  /** True while the model is missing — every microphone affordance routes through `guard`. */
  blocked: boolean
  /**
   * Runs `action` now if the model exists; otherwise remembers it, opens the
   * gate, and runs it the moment the model lands **while the gate is still open**.
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
  const readiness = useAsrReadiness(active)
  const installed = readiness.readiness?.installed ?? null
  const ready = installed === true
  const [open, setOpen] = useState(false)
  const pending = useRef<(() => void) | null>(null)
  const { refresh } = readiness

  // A model that lands anywhere — here, the settings sheet, another window —
  // makes this surface usable, so readiness is re-resolved on any ending.
  useAsrDownloadEndings(
    useCallback(
      (download) => {
        if (download.status === 'done') refresh()
      },
      [refresh]
    )
  )

  useEffect(() => {
    if (!open || !ready) return
    // Named-and-invoked (the repo's `load()` pattern) so the state write is not
    // a bare call in the effect body — `react-hooks/set-state-in-effect`.
    function proceed(): void {
      const action = pending.current
      pending.current = null
      setOpen(false)
      action?.()
    }
    proceed()
  }, [open, ready])

  const guard = useCallback(
    (action: () => void) => {
      if (ready) {
        action()
        return
      }
      pending.current = action
      setOpen(true)
    },
    [ready]
  )

  const changeOpen = useCallback((next: boolean) => {
    if (!next) pending.current = null
    setOpen(next)
  }, [])

  return { ready, installed, blocked: !ready, guard, open, setOpen: changeOpen }
}
