import { toDownloadFailure, type AsrModelStore } from './asrModelStore'
import type { AsrDownload, AsrDownloadFailure, AsrModelId } from './asrTypes'

/**
 * Weight given to the newest throughput sample when smoothing the rate.
 *
 * Low, on purpose. Raw deltas over a 250 ms window on a residential connection
 * swing by an order of magnitude, and a "tempo restante" that flickers between
 * 4 and 40 minutes is worse than none at all — it is the same defect as a
 * progress bar that jumps backwards, just spelled in words.
 */
const RATE_SMOOTHING = 0.25

/** Rate samples closer together than this are folded into the next one. */
const RATE_SAMPLE_MS = 500

/**
 * Background download of the ASR model — **owned by main, not by a window.**
 *
 * The surface this replaces made the renderer the owner: `downloadModel` opened
 * an IPC subscription, and the preload's teardown sent `whisper:download:stop`.
 * Closing the sheet therefore stopped the download — a multi-gigabyte transfer
 * killed by navigating away from the page that started it.
 *
 * Here a download is a record with a lifetime of its own. Windows subscribe to
 * the snapshot and can come and go; the transfer keeps running and reports its
 * own ending to whoever is listening — including, when nobody is, the operating
 * system's notification centre.
 *
 * It stays keyed by model id even though M29 leaves exactly one model. The key
 * is what makes "cancel this one" and "dismiss this one" addressable without
 * the caller and the manager having to agree on a singleton, and it is what the
 * existing lifecycle tests are written against.
 */
export interface AsrDownloadManager {
  /** Every download worth showing: all in-flight ones, plus unacknowledged failures. */
  list(): AsrDownload[]
  /**
   * Starts (or resumes) a download. Idempotent while one is already running for
   * `id` — clicking "Baixar" twice must not spawn a second transfer into the
   * same directory.
   */
  start(id: AsrModelId): AsrDownload
  /** Aborts an in-flight download and throws away its partial bytes. */
  cancel(id: AsrModelId): void
  /** Clears a settled record the user has seen. */
  dismiss(id: AsrModelId): void
  /** Snapshot subscription — fires on every change, with the whole list. */
  subscribe(listener: (downloads: AsrDownload[]) => void): () => void
  /** One-shot subscription to endings, for notifications. Never fires for progress. */
  onSettled(listener: (download: AsrDownload) => void): () => void
  /** Resolves when `id` stops downloading; `null` if it was never downloading. */
  whenSettled(id: AsrModelId): Promise<AsrDownload | null>
  /** Aborts everything — app shutdown, so a half-written temp dir is not left mid-rename. */
  stopAll(): void
}

export interface AsrDownloadDeps {
  store: Pick<AsrModelStore, 'download' | 'discardPartial' | 'partialBytes'>
  /** Injected clock, so the rate/ETA maths is asserted without real time passing. */
  now?: () => number
}

/** Per-download bookkeeping that never crosses IPC. */
interface Live {
  controller: AbortController
  lastBytes: number
  lastAt: number
  settled: Array<(download: AsrDownload) => void>
}

export function createAsrDownloadManager(deps: AsrDownloadDeps): AsrDownloadManager {
  const now = deps.now ?? Date.now
  const records = new Map<AsrModelId, AsrDownload>()
  const live = new Map<AsrModelId, Live>()
  const snapshotListeners = new Set<(downloads: AsrDownload[]) => void>()
  const settledListeners = new Set<(download: AsrDownload) => void>()

  const list = (): AsrDownload[] => [...records.values()]

  const emit = (): void => {
    const snapshot = list()
    for (const listener of snapshotListeners) listener(snapshot)
  }

  const settle = (record: AsrDownload): void => {
    const handle = live.get(record.id)
    live.delete(record.id)
    // A failure is the one ending that stays on the list: it is the only one
    // the user still has to decide something about (retry, or give up), and a
    // 20-minute download that failed while the sheet was closed must still be
    // there when they come back.
    if (record.status === 'error') records.set(record.id, record)
    else records.delete(record.id)
    emit()
    for (const listener of settledListeners) listener(record)
    if (handle) for (const resolve of handle.settled) resolve(record)
  }

  const patch = (id: AsrModelId, changes: Partial<AsrDownload>): AsrDownload | null => {
    const current = records.get(id)
    if (!current) return null
    const next = { ...current, ...changes, updatedAt: now() }
    records.set(id, next)
    return next
  }

  /**
   * Folds one progress reading into the record, including the smoothed rate.
   *
   * The rate is measured between readings rather than over the whole download,
   * because the number is being used for "how much longer" — and the answer to
   * that is what the connection is doing now, not what it averaged over the
   * twenty minutes that included a sleep.
   */
  const onProgress = (id: AsrModelId, loaded: number, total: number, file: string): void => {
    const handle = live.get(id)
    const current = records.get(id)
    if (!handle || !current) return
    const at = now()
    const elapsed = at - handle.lastAt
    let bytesPerSecond = current.bytesPerSecond
    if (elapsed >= RATE_SAMPLE_MS) {
      const sample = ((loaded - handle.lastBytes) * 1000) / elapsed
      bytesPerSecond =
        current.bytesPerSecond === 0
          ? Math.max(0, sample)
          : current.bytesPerSecond * (1 - RATE_SMOOTHING) + Math.max(0, sample) * RATE_SMOOTHING
      handle.lastBytes = loaded
      handle.lastAt = at
    }
    patch(id, { loaded, total, file, bytesPerSecond: Math.round(bytesPerSecond) })
    emit()
  }

  function start(id: AsrModelId): AsrDownload {
    const running = records.get(id)
    if (running?.status === 'downloading') return running

    const controller = new AbortController()
    const startedAt = now()
    const record: AsrDownload = {
      id,
      status: 'downloading',
      // Resumed bytes count from the first frame: a bar that restarts at 0 %
      // on a resumed download says the opposite of what just happened.
      loaded: deps.store.partialBytes(),
      total: 0,
      file: '',
      bytesPerSecond: 0,
      failure: null,
      startedAt,
      updatedAt: startedAt
    }
    records.set(id, record)
    live.set(id, { controller, lastBytes: record.loaded, lastAt: startedAt, settled: [] })
    emit()

    void deps.store
      .download(
        (event) => {
          if (event.type === 'progress') onProgress(id, event.loaded, event.total, event.file)
        },
        { signal: controller.signal }
      )
      .then(() => {
        const done = patch(id, { status: 'done', loaded: records.get(id)?.total ?? 0 })
        if (done) settle(done)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          const cancelled = patch(id, { status: 'cancelled' })
          if (cancelled) settle(cancelled)
          return
        }
        const failure: AsrDownloadFailure = toDownloadFailure(error)
        const failed = patch(id, { status: 'error', failure, bytesPerSecond: 0 })
        if (failed) settle(failed)
      })

    return record
  }

  function cancel(id: AsrModelId): void {
    const handle = live.get(id)
    if (!handle) {
      // Nothing running: "cancel" on a settled row means "forget it".
      dismiss(id)
      return
    }
    handle.controller.abort()
    // The abort surfaces through the download's own rejection, but the partial
    // bytes are dropped here: a cancel is the one ending where keeping 2 GB of
    // resumable temp files would be storing something nobody asked for.
    deps.store.discardPartial()
  }

  function dismiss(id: AsrModelId): void {
    if (!records.has(id)) return
    if (records.get(id)?.status === 'downloading') return
    records.delete(id)
    emit()
  }

  function subscribe(listener: (downloads: AsrDownload[]) => void): () => void {
    snapshotListeners.add(listener)
    listener(list())
    return () => snapshotListeners.delete(listener)
  }

  function onSettled(listener: (download: AsrDownload) => void): () => void {
    settledListeners.add(listener)
    return () => settledListeners.delete(listener)
  }

  function whenSettled(id: AsrModelId): Promise<AsrDownload | null> {
    const handle = live.get(id)
    if (!handle) return Promise.resolve(null)
    return new Promise((resolve) => handle.settled.push(resolve))
  }

  function stopAll(): void {
    for (const handle of live.values()) handle.controller.abort()
  }

  return { list, start, cancel, dismiss, subscribe, onSettled, whenSettled, stopAll }
}
