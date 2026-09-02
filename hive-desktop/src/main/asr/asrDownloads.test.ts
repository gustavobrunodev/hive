import { describe, expect, it, vi } from 'vitest'
import { createAsrDownloadManager } from './asrDownloads'
import { AsrDownloadError } from './asrModelStore'
import { PARAKEET_MODEL_ID } from './asrTypes'
import type { AsrDownload, AsrDownloadEvent } from './asrTypes'

/** The one model there is (M29). */
const MODEL = PARAKEET_MODEL_ID

/**
 * A store stand-in whose `download` is driven by the test: the manager's whole
 * job is lifecycle (records, rate, settling, broadcast), so the transfer itself
 * is a promise the test resolves when it wants to.
 */
function fakeStore(): {
  store: Parameters<typeof createAsrDownloadManager>[0]['store']
  emit: (event: AsrDownloadEvent) => void
  finish: () => void
  fail: (error: unknown) => void
  aborted: () => boolean
  discarded: number
  partial: { bytes: number }
} {
  let emitter: ((event: AsrDownloadEvent) => void) | null = null
  let settler: { resolve: () => void; reject: (e: unknown) => void } | null = null
  let signal: AbortSignal | undefined
  const state = { discarded: 0 }
  const partial = { bytes: 0 }

  return {
    partial,
    get discarded() {
      return state.discarded
    },
    store: {
      partialBytes: () => partial.bytes,
      discardPartial: () => {
        state.discarded += 1
      },
      download: (onEvent, options) => {
        emitter = onEvent
        signal = options?.signal
        return new Promise<void>((resolve, reject) => {
          settler = { resolve, reject }
        })
      }
    },
    emit: (event) => emitter?.(event),
    finish: () => settler?.resolve(),
    fail: (error) => settler?.reject(error),
    aborted: () => signal?.aborted === true
  }
}

/** Lets the manager's `.then`/`.catch` microtasks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('asrDownloads', () => {
  it('registers a download and broadcasts the snapshot', () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    const seen: AsrDownload[][] = []
    manager.subscribe((list) => seen.push(list))

    manager.start(MODEL)

    expect(manager.list()).toMatchObject([{ id: MODEL, status: 'downloading', loaded: 0 }])
    // One snapshot on subscribe (empty), one for the new record.
    expect(seen).toHaveLength(2)
    expect(seen.at(-1)).toHaveLength(1)
  })

  it('starts a resumed download from the bytes already on disk', () => {
    const fake = fakeStore()
    fake.partial.bytes = 900
    const manager = createAsrDownloadManager({ store: fake.store })
    expect(manager.start(MODEL).loaded).toBe(900)
  })

  it('is idempotent while a download for the same model is running', () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    const first = manager.start(MODEL)
    const second = manager.start(MODEL)
    expect(second).toBe(first)
    expect(manager.list()).toHaveLength(1)
  })

  it('folds progress into the record and measures a smoothed rate', () => {
    const fake = fakeStore()
    let clock = 0
    const manager = createAsrDownloadManager({ store: fake.store, now: () => clock })
    manager.start(MODEL)

    clock = 1_000
    fake.emit({ type: 'progress', id: MODEL, loaded: 500, total: 3_000, file: 'a' })
    const first = manager.list()[0]
    expect(first).toMatchObject({ loaded: 500, total: 3_000, file: 'a' })
    expect(first.bytesPerSecond).toBe(500)

    clock = 2_000
    fake.emit({ type: 'progress', id: MODEL, loaded: 1_500, total: 3_000, file: 'b' })
    // Smoothed toward the new 1000 B/s sample, not snapped to it.
    expect(manager.list()[0].bytesPerSecond).toBe(625)
  })

  it('ignores samples too close together to measure anything', () => {
    const fake = fakeStore()
    let clock = 0
    const manager = createAsrDownloadManager({ store: fake.store, now: () => clock })
    manager.start(MODEL)
    clock = 10
    fake.emit({ type: 'progress', id: MODEL, loaded: 40, total: 3_000, file: 'a' })
    expect(manager.list()[0]).toMatchObject({ loaded: 40, bytesPerSecond: 0 })
  })

  it('drops a completed download from the list and announces it once', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    const settled = vi.fn()
    manager.onSettled(settled)

    manager.start(MODEL)
    fake.emit({ type: 'progress', id: MODEL, loaded: 10, total: 3_000, file: 'a' })
    fake.finish()
    await flush()

    expect(manager.list()).toEqual([])
    expect(settled).toHaveBeenCalledTimes(1)
    expect(settled.mock.calls[0][0]).toMatchObject({ id: MODEL, status: 'done', loaded: 3_000 })
  })

  it('keeps a failure on the list, typed, so a closed sheet can still report it', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)
    fake.fail(new AsrDownloadError('disk', 'no space'))
    await flush()

    expect(manager.list()).toMatchObject([
      { id: MODEL, status: 'error', failure: { kind: 'disk', detail: 'no space' } }
    ])
  })

  it('dismisses a settled failure but never a running download', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)
    manager.dismiss(MODEL)
    expect(manager.list()).toHaveLength(1)

    fake.fail(new Error('boom'))
    await flush()
    manager.dismiss(MODEL)
    expect(manager.list()).toEqual([])
  })

  it('cancels by aborting the transfer and throwing away the partial bytes', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)

    manager.cancel(MODEL)
    expect(fake.aborted()).toBe(true)
    expect(fake.discarded).toBe(1)

    fake.fail(new Error('aborted'))
    await flush()
    expect(manager.list()).toEqual([])
  })

  it('cancelling something already settled just forgets it', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)
    fake.fail(new Error('boom'))
    await flush()

    manager.cancel(MODEL)
    expect(manager.list()).toEqual([])
    // No partial discard for a model that is not transferring.
    expect(fake.discarded).toBe(0)
  })

  it('resolves whenSettled with the ending, and null for an unknown model', async () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)
    const pending = manager.whenSettled(MODEL)
    fake.finish()
    await expect(pending).resolves.toMatchObject({ status: 'done' })
    // Nothing downloading is not an ending to wait for.
    await expect(manager.whenSettled(MODEL)).resolves.toBeNull()
  })

  it('unsubscribing stops the snapshots but never the download', () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    const seen: AsrDownload[][] = []
    const off = manager.subscribe((list) => seen.push(list))
    manager.start(MODEL)
    off()
    fake.emit({ type: 'progress', id: MODEL, loaded: 99, total: 3_000, file: 'a' })

    expect(seen).toHaveLength(2)
    expect(manager.list()[0].loaded).toBe(99)
  })

  it('stopAll aborts the live transfer, for shutdown', () => {
    const fake = fakeStore()
    const manager = createAsrDownloadManager({ store: fake.store })
    manager.start(MODEL)
    manager.stopAll()
    // Shutdown mid-rename is how a temp dir is left in a state the next run
    // cannot resume from.
    expect(fake.aborted()).toBe(true)
  })
})
