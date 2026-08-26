import { describe, expect, it, vi } from 'vitest'
import { createWhisperDownloadManager } from './whisperDownloads'
import { WhisperDownloadError } from './whisperModelStore'
import type { WhisperDownload, WhisperDownloadEvent, WhisperModelId } from './whisperTypes'

/**
 * A store stand-in whose `download` is driven by the test: the manager's whole
 * job is lifecycle (records, rate, settling, broadcast), so the transfer itself
 * is a promise the test resolves when it wants to.
 */
function fakeStore(): {
  store: Parameters<typeof createWhisperDownloadManager>[0]['store']
  emit: (id: WhisperModelId, event: WhisperDownloadEvent) => void
  finish: (id: WhisperModelId) => void
  fail: (id: WhisperModelId, error: unknown) => void
  aborted: (id: WhisperModelId) => boolean
  discarded: WhisperModelId[]
  partial: Map<WhisperModelId, number>
} {
  const emitters = new Map<WhisperModelId, (event: WhisperDownloadEvent) => void>()
  const settlers = new Map<WhisperModelId, { resolve: () => void; reject: (e: unknown) => void }>()
  const signals = new Map<WhisperModelId, AbortSignal>()
  const discarded: WhisperModelId[] = []
  const partial = new Map<WhisperModelId, number>()

  return {
    discarded,
    partial,
    store: {
      partialBytes: (id) => partial.get(id) ?? 0,
      discardPartial: (id) => discarded.push(id),
      download: (id, _variant, onEvent, options) => {
        emitters.set(id, onEvent)
        if (options?.signal) signals.set(id, options.signal)
        return new Promise<void>((resolve, reject) => settlers.set(id, { resolve, reject }))
      }
    },
    emit: (id, event) => emitters.get(id)?.(event),
    finish: (id) => settlers.get(id)?.resolve(),
    fail: (id, error) => settlers.get(id)?.reject(error),
    aborted: (id) => signals.get(id)?.aborted === true
  }
}

/** Lets the manager's `.then`/`.catch` microtasks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('whisperDownloads', () => {
  it('registers a download and broadcasts the snapshot', () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    const seen: WhisperDownload[][] = []
    manager.subscribe((list) => seen.push(list))

    manager.start('medium', 'fp32')

    expect(manager.list()).toMatchObject([{ id: 'medium', status: 'downloading', loaded: 0 }])
    // One snapshot on subscribe (empty), one for the new record.
    expect(seen).toHaveLength(2)
    expect(seen.at(-1)).toHaveLength(1)
  })

  it('starts a resumed download from the bytes already on disk', () => {
    const fake = fakeStore()
    fake.partial.set('medium', 900)
    const manager = createWhisperDownloadManager({ store: fake.store })
    expect(manager.start('medium', 'fp32').loaded).toBe(900)
  })

  it('is idempotent while a download for the same model is running', () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    const first = manager.start('medium', 'fp32')
    const second = manager.start('medium', 'fp32')
    expect(second).toBe(first)
    expect(manager.list()).toHaveLength(1)
  })

  it('runs two models at once — one is not the cap', () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    manager.start('small', 'fp32')
    expect(
      manager
        .list()
        .map((d) => d.id)
        .sort()
    ).toEqual(['medium', 'small'])
  })

  it('folds progress into the record and measures a smoothed rate', () => {
    const fake = fakeStore()
    let clock = 0
    const manager = createWhisperDownloadManager({ store: fake.store, now: () => clock })
    manager.start('medium', 'fp32')

    clock = 1_000
    fake.emit('medium', { type: 'progress', id: 'medium', loaded: 500, total: 3_000, file: 'a' })
    const first = manager.list()[0]
    expect(first).toMatchObject({ loaded: 500, total: 3_000, file: 'a' })
    expect(first.bytesPerSecond).toBe(500)

    clock = 2_000
    fake.emit('medium', { type: 'progress', id: 'medium', loaded: 1_500, total: 3_000, file: 'b' })
    // Smoothed toward the new 1000 B/s sample, not snapped to it.
    expect(manager.list()[0].bytesPerSecond).toBe(625)
  })

  it('ignores samples too close together to measure anything', () => {
    const fake = fakeStore()
    let clock = 0
    const manager = createWhisperDownloadManager({ store: fake.store, now: () => clock })
    manager.start('medium', 'fp32')
    clock = 10
    fake.emit('medium', { type: 'progress', id: 'medium', loaded: 40, total: 3_000, file: 'a' })
    expect(manager.list()[0]).toMatchObject({ loaded: 40, bytesPerSecond: 0 })
  })

  it('drops a completed download from the list and announces it once', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    const settled = vi.fn()
    manager.onSettled(settled)

    manager.start('medium', 'fp32')
    fake.emit('medium', { type: 'progress', id: 'medium', loaded: 10, total: 3_000, file: 'a' })
    fake.finish('medium')
    await flush()

    expect(manager.list()).toEqual([])
    expect(settled).toHaveBeenCalledTimes(1)
    expect(settled.mock.calls[0][0]).toMatchObject({ id: 'medium', status: 'done', loaded: 3_000 })
  })

  it('keeps a failure on the list, typed, so a closed sheet can still report it', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    fake.fail('medium', new WhisperDownloadError('disk', 'no space'))
    await flush()

    expect(manager.list()).toMatchObject([
      { id: 'medium', status: 'error', failure: { kind: 'disk', detail: 'no space' } }
    ])
  })

  it('dismisses a settled failure but never a running download', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    manager.dismiss('medium')
    expect(manager.list()).toHaveLength(1)

    fake.fail('medium', new Error('boom'))
    await flush()
    manager.dismiss('medium')
    expect(manager.list()).toEqual([])
  })

  it('cancels by aborting the transfer and throwing away the partial bytes', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')

    manager.cancel('medium')
    expect(fake.aborted('medium')).toBe(true)
    expect(fake.discarded).toEqual(['medium'])

    fake.fail('medium', new Error('aborted'))
    await flush()
    expect(manager.list()).toEqual([])
  })

  it('cancelling something already settled just forgets it', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    fake.fail('medium', new Error('boom'))
    await flush()

    manager.cancel('medium')
    expect(manager.list()).toEqual([])
    // No partial discard for a model that is not transferring.
    expect(fake.discarded).toEqual([])
  })

  it('resolves whenSettled with the ending, and null for an unknown model', async () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    const pending = manager.whenSettled('medium')
    fake.finish('medium')
    await expect(pending).resolves.toMatchObject({ status: 'done' })
    await expect(manager.whenSettled('tiny')).resolves.toBeNull()
  })

  it('unsubscribing stops the snapshots but never the download', () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    const seen: WhisperDownload[][] = []
    const off = manager.subscribe((list) => seen.push(list))
    manager.start('medium', 'fp32')
    off()
    fake.emit('medium', { type: 'progress', id: 'medium', loaded: 99, total: 3_000, file: 'a' })

    expect(seen).toHaveLength(2)
    expect(manager.list()[0].loaded).toBe(99)
  })

  it('stopAll aborts every live transfer, for shutdown', () => {
    const fake = fakeStore()
    const manager = createWhisperDownloadManager({ store: fake.store })
    manager.start('medium', 'fp32')
    manager.start('small', 'fp32')
    manager.stopAll()
    expect(fake.aborted('medium')).toBe(true)
    expect(fake.aborted('small')).toBe(true)
  })
})
