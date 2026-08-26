import { useCallback, useEffect, useState } from 'react'
import { probeWebGpu, type WhisperVariant } from './useWhisper'
import type { ModelInfo } from '../../profile/voiceCopy'

export interface WhisperCatalog {
  /** Every model the app knows about, with its local availability. */
  models: ModelInfo[]
  /**
   * Has main answered yet?
   *
   * Distinct from `models.length === 0`, and the distinction is load-bearing:
   * the catalog always has ten rows whether or not any of them is on disk, so
   * an empty list means "not asked yet", never "nothing here". A surface that
   * reads the length alone renders "nothing left to download" — a confident,
   * wrong statement — for the length of one IPC round trip.
   */
  loaded: boolean
  /**
   * Which precision a **download** would fetch on this machine.
   *
   * Not what will actually run: a model already on disk is used in whichever
   * precision it was fetched in, if this device can load it (see
   * `chooseVariant`). This only sizes the rows for a model that is not here
   * yet, so the figure in the catalog is the truth for *this* user rather than
   * a generic one.
   */
  variant: WhisperVariant
  /** Re-reads the catalog — after a download, a deletion, or a manager close. */
  refresh: () => void
}

/**
 * The model catalog, loaded only while the surface that shows it is open.
 *
 * Its own hook because the panel that needed it was carrying two effects, two
 * cancellation flags and a WebGPU probe purely to render one row — enough
 * branching on its own to push the component past the project's complexity
 * ceiling, which is the sensor that asked for this split.
 */
export function useWhisperCatalog(open: boolean, refreshKey?: unknown): WhisperCatalog {
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [variant, setVariant] = useState<WhisperVariant>('fp32')

  const refresh = useCallback(() => {
    void window.hive.whisper.listModels().then(setModels)
  }, [])

  // The catalog changes when a model is downloaded or deleted, so it is re-read
  // on open (and on `refreshKey`) rather than held app-wide.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.hive.whisper.listModels().then((list) => {
      if (!cancelled) setModels(list)
    })
    return () => {
      cancelled = true
    }
  }, [open, refreshKey])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void probeWebGpu().then((gpu) => {
      if (!cancelled) setVariant(gpu ? 'q8' : 'fp32')
    })
    return () => {
      cancelled = true
    }
  }, [open])

  return { models: models ?? [], loaded: models !== null, variant, refresh }
}
