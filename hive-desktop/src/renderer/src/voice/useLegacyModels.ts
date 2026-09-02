import { useCallback, useEffect, useState } from 'react'

/**
 * The pre-M29 Whisper store, as space the user can choose to free.
 *
 * It is deliberately not a migration. What is on disk is a download someone
 * waited twenty minutes for — often several gigabytes — and deleting it on
 * first launch after an update is a surprise with no undo. So the app measures
 * it, says the number, and puts a button next to it.
 */
export interface LegacyModelsState {
  /** Bytes still occupied, `0` once freed, `null` until main answers. */
  bytes: number | null
  /** Frees the space. Resolves once main has answered with what is left. */
  remove: () => Promise<void>
}

export function useLegacyModels(active = true): LegacyModelsState {
  const [bytes, setBytes] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void window.hive.asr.legacyModelBytes().then((value) => {
      if (!cancelled) setBytes(value)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const remove = useCallback(async () => {
    setBytes(await window.hive.asr.removeLegacyModels())
  }, [])

  return { bytes, remove }
}
