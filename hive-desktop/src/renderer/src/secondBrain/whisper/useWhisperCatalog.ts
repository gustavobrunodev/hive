import { useCallback, useEffect, useState } from 'react'
import { probeWebGpu, type WhisperVariant } from './useWhisper'
import type { ModelInfo } from './modelCopy'

export interface WhisperCatalog {
  /** Every model the app knows about, with its local availability. */
  models: ModelInfo[]
  /**
   * Which precision a **download** would fetch on this machine.
   *
   * Not what will actually run: the bundled models ship as fp32 and are used as
   * they are (see `chooseVariant`). This only sizes the rows for a model that
   * is not here yet, so the figure in the catalog is the truth for *this* user
   * rather than a generic one.
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
  const [models, setModels] = useState<ModelInfo[]>([])
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

  return { models, variant, refresh }
}
