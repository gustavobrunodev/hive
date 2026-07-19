import { describe, expect, it, vi } from 'vitest'
import { createUpdateService, type UpdateEvent, type UpdaterLike } from './updateService'

/** Fake electron-updater: captures listeners so tests can fire its events. */
function createFakeUpdater(): UpdaterLike & {
  fire: (event: string, payload?: unknown) => void
} {
  const listeners = new Map<string, (payload?: unknown) => void>()
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on: vi.fn((event: string, listener: (payload?: unknown) => void) => {
      listeners.set(event, listener)
    }),
    checkForUpdates: vi.fn(() => Promise.resolve(null)),
    downloadUpdate: vi.fn(() => Promise.resolve([])),
    quitAndInstall: vi.fn(),
    fire: (event, payload) => listeners.get(event)?.(payload)
  }
}

describe('updateService', () => {
  it('disables auto download/install — the flow is user-driven', () => {
    const updater = createFakeUpdater()
    createUpdateService(updater, true)
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
  })

  it('maps updater events to typed UpdateEvents for subscribers', () => {
    const updater = createFakeUpdater()
    const service = createUpdateService(updater, true)
    const seen: UpdateEvent[] = []
    service.onEvent((event) => seen.push(event))

    updater.fire('checking-for-update')
    updater.fire('update-available', { version: '0.2.0' })
    updater.fire('download-progress', { percent: 42.5 })
    updater.fire('update-downloaded', { version: '0.2.0' })
    updater.fire('update-not-available')
    updater.fire('error', new Error('offline'))

    expect(seen).toEqual([
      { type: 'checking' },
      { type: 'available', version: '0.2.0' },
      { type: 'progress', percent: 42.5 },
      { type: 'downloaded', version: '0.2.0' },
      { type: 'not-available' },
      { type: 'error', message: 'offline' }
    ])
  })

  it('tolerates malformed updater payloads (missing version/percent)', () => {
    const updater = createFakeUpdater()
    const service = createUpdateService(updater, true)
    const seen: UpdateEvent[] = []
    service.onEvent((event) => seen.push(event))

    updater.fire('update-available', undefined)
    updater.fire('download-progress', {})

    expect(seen).toEqual([
      { type: 'available', version: '' },
      { type: 'progress', percent: 0 }
    ])
  })

  it('unsubscribe stops delivery; check/download/install drive the updater when supported', () => {
    const updater = createFakeUpdater()
    const service = createUpdateService(updater, true)
    const seen: UpdateEvent[] = []
    const unsubscribe = service.onEvent((event) => seen.push(event))
    unsubscribe()
    updater.fire('checking-for-update')
    expect(seen).toEqual([])

    service.check()
    service.download()
    service.install()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('a checkForUpdates rejection is swallowed (the updater already emitted its own error event)', async () => {
    const updater = createFakeUpdater()
    vi.mocked(updater.checkForUpdates).mockRejectedValueOnce(new Error('net down'))
    const service = createUpdateService(updater, true)
    service.check()
    // Flush the rejection; an unhandled one would fail the test run.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('unsupported (dev/unpacked): never touches the updater and subscribes nothing', () => {
    const updater = createFakeUpdater()
    const service = createUpdateService(updater, false)
    expect(updater.on).not.toHaveBeenCalled()
    // Auto flags untouched — nothing to configure on an updater we never use.
    expect(updater.autoDownload).toBe(true)

    service.check()
    service.download()
    service.install()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})
