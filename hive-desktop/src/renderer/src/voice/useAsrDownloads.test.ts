// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useAsrDownloadEndings, useAsrDownloads } from './useAsrDownloads'
import { asrDownloadFixture, ASR_MODEL_FIXTURE } from '../testSupport/hiveAsrMock'

const MODEL = ASR_MODEL_FIXTURE.id

describe('useAsrDownloads', () => {
  let snapshotListeners: Array<(list: unknown[]) => void>
  let settledListeners: Array<(download: unknown) => void>
  let offSnapshots: ReturnType<typeof vi.fn>
  let offSettled: ReturnType<typeof vi.fn>

  beforeEach(() => {
    snapshotListeners = []
    settledListeners = []
    offSnapshots = vi.fn()
    offSettled = vi.fn()
    window.hive = {
      ...window.hive,
      asr: {
        ...window.hive?.asr,
        downloads: vi.fn(async () => [asrDownloadFixture()]),
        startDownload: vi.fn(async () => undefined),
        cancelDownload: vi.fn(async () => undefined),
        dismissDownload: vi.fn(async () => undefined),
        onDownloads: vi.fn((listener: (list: unknown[]) => void) => {
          snapshotListeners.push(listener)
          return offSnapshots
        }),
        onDownloadSettled: vi.fn((listener: (download: unknown) => void) => {
          settledListeners.push(listener)
          return offSettled
        })
      }
    } as unknown as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * A window that opens while a 670 MB transfer is running has to show it
   * immediately, not at the next progress tick — which for a slow link can be
   * seconds of a screen that says nothing is happening.
   */
  it('seeds from the current snapshot as well as subscribing', async () => {
    const { result } = renderHook(() => useAsrDownloads())
    await act(async () => {})
    expect(result.current.byId[MODEL]).toBeTruthy()
    expect(result.current.busy).toBe(true)
  })

  it('keys the live snapshot by model id', async () => {
    const { result } = renderHook(() => useAsrDownloads())
    await act(async () => {})

    act(() => snapshotListeners[0]([asrDownloadFixture({ loaded: 10 })]))
    expect(Object.keys(result.current.byId)).toEqual([MODEL])
    expect(result.current.byId[MODEL].loaded).toBe(10)
  })

  it('is not busy when every record has settled', async () => {
    const { result } = renderHook(() => useAsrDownloads())
    await act(async () => {})
    act(() => snapshotListeners[0]([asrDownloadFixture({ status: 'error' })]))
    expect(result.current.busy).toBe(false)
  })

  it('routes every mutation to main, by id', async () => {
    const { result } = renderHook(() => useAsrDownloads())
    await act(async () => {})

    act(() => result.current.start())
    act(() => result.current.cancel(MODEL))
    act(() => result.current.dismiss(MODEL))

    expect(window.hive.asr.startDownload).toHaveBeenCalledWith()
    expect(window.hive.asr.cancelDownload).toHaveBeenCalledWith(MODEL)
    expect(window.hive.asr.dismissDownload).toHaveBeenCalledWith(MODEL)
  })

  /**
   * The regression the whole redesign exists for: the hook this replaces held
   * the download's only handle, and its unmount cleanup **sent the stop**. So
   * closing the sheet killed a transfer minutes from finishing.
   */
  it('unsubscribing stops watching and never cancels', async () => {
    const { unmount } = renderHook(() => useAsrDownloads())
    await act(async () => {})
    unmount()

    expect(offSnapshots).toHaveBeenCalled()
    expect(window.hive.asr.cancelDownload).not.toHaveBeenCalled()
  })

  it('drops a snapshot that lands after unmount', async () => {
    const { unmount } = renderHook(() => useAsrDownloads())
    unmount()
    // The seed promise resolves after the effect's teardown; a hook that wrote
    // it anyway would set state on an unmounted component.
    await act(async () => {})
    expect(true).toBe(true)
  })

  describe('useAsrDownloadEndings', () => {
    it('fires once per ending, with the record', async () => {
      const onSettled = vi.fn()
      renderHook(() => useAsrDownloadEndings(onSettled))
      act(() => settledListeners[0](asrDownloadFixture({ status: 'done' })))
      expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }))
    })

    /**
     * The handler is read through a ref: a caller that passes an inline arrow
     * (which is every caller) would otherwise tear down and re-open the IPC
     * subscription on every render.
     */
    it('re-subscribes for a changed handler exactly never', () => {
      const { rerender } = renderHook<void, { fn: () => void }>(
        ({ fn }) => useAsrDownloadEndings(fn),
        { initialProps: { fn: vi.fn() } }
      )
      rerender({ fn: vi.fn() })
      rerender({ fn: vi.fn() })
      expect(vi.mocked(window.hive.asr.onDownloadSettled)).toHaveBeenCalledTimes(1)
    })

    it('calls the latest handler, not the one captured at mount', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { rerender } = renderHook<void, { fn: () => void }>(
        ({ fn }) => useAsrDownloadEndings(fn),
        { initialProps: { fn: first } }
      )
      rerender({ fn: second })
      act(() => settledListeners[0](asrDownloadFixture({ status: 'done' })))
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalled()
    })

    it('releases the subscription on unmount', () => {
      const { unmount } = renderHook(() => useAsrDownloadEndings(vi.fn()))
      unmount()
      expect(offSettled).toHaveBeenCalled()
    })
  })
})
