import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsrDownload } from './downloadCopy'

type AsrModelId = Parameters<Window['hive']['asr']['cancelDownload']>[0]

export interface AsrDownloadsState {
  /** Every download main knows about, keyed by model id. */
  byId: Record<string, AsrDownload>
  /** True while anything at all is transferring. */
  busy: boolean
  start: () => void
  cancel: (id: AsrModelId) => void
  /** Clears a settled failure the user has acknowledged. */
  dismiss: (id: AsrModelId) => void
}

/**
 * A **view** of the downloads main is running — never their owner.
 *
 * That distinction is the whole point, and it is what the hook this replaces
 * got wrong: it held the download's IPC subscription, and its unmount cleanup
 * sent the stop. So closing the sheet stopped the transfer, and reopening it
 * found no trace that anything had ever been started.
 *
 * Here the effect only listens. Every mutation is an explicit call, so a window
 * can come and go mid-transfer and the surface that started a download is not
 * the thing keeping it alive.
 */
export function useAsrDownloads(): AsrDownloadsState {
  const [byId, setById] = useState<Record<string, AsrDownload>>({})

  useEffect(() => {
    let cancelled = false
    const apply = (list: AsrDownload[]): void => {
      if (cancelled) return
      setById(Object.fromEntries(list.map((download) => [download.id, download])))
    }
    // Seeded *and* subscribed: a window that opens while a download is in
    // flight has to show it immediately, not at the next progress tick.
    void window.hive.asr.downloads().then(apply)
    const off = window.hive.asr.onDownloads(apply)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const start = useCallback(() => {
    void window.hive.asr.startDownload()
  }, [])
  const cancel = useCallback((id: AsrModelId) => {
    void window.hive.asr.cancelDownload(id)
  }, [])
  const dismiss = useCallback((id: AsrModelId) => {
    void window.hive.asr.dismissDownload(id)
  }, [])

  const busy = Object.values(byId).some((download) => download.status === 'downloading')
  return { byId, busy, start, cancel, dismiss }
}

/**
 * Fires `onSettled` once per download that ends, for as long as this is mounted.
 *
 * Its own hook because the ending is a *moment*, not a state: the record leaves
 * the snapshot when it completes, so a component that only watched `byId` would
 * see a download disappear and have no way to tell success from cancellation.
 */
export function useAsrDownloadEndings(onSettled: (download: AsrDownload) => void): void {
  const handler = useRef(onSettled)
  useEffect(() => {
    handler.current = onSettled
  }, [onSettled])

  useEffect(() => window.hive.asr.onDownloadSettled((d) => handler.current(d)), [])
}
