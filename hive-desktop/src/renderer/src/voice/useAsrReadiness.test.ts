// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAsrInstalled, useAsrReadiness } from './useAsrReadiness'
import { asrReadinessFixture, createHiveAsrMock } from '../testSupport/hiveAsrMock'

/**
 * Whether the app can transcribe. The descendant of `useWhisperPreference`,
 * which subscribed to "which of ten models is in force"; with one model the
 * only live question is whether its bytes are on disk — and that question is
 * load-bearing in exactly the way the old one was, because the app ships no
 * weights.
 */

describe('useAsrReadiness', () => {
  let bridge: ReturnType<typeof createHiveAsrMock>

  beforeEach(() => {
    bridge = createHiveAsrMock()
    window.hive = { ...window.hive, asr: bridge } as unknown as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('answers null until main replies, then the real state', async () => {
    bridge.readiness.mockResolvedValue(asrReadinessFixture({ installed: true }))
    const { result } = renderHook(() => useAsrReadiness())
    // `null` is "not asked yet", not "none": rendering a fallback during the
    // round trip would state a fact that is about to change under the reader.
    expect(result.current.readiness).toBeNull()
    await waitFor(() => expect(result.current.readiness?.installed).toBe(true))
  })

  it('asks nothing at all while the surface is closed', async () => {
    renderHook(() => useAsrReadiness(false))
    await act(async () => {})
    // A closed sheet's hooks still run; holding an IPC round trip for a screen
    // nobody is looking at is what `active` exists to prevent.
    expect(bridge.readiness).not.toHaveBeenCalled()
  })

  it('re-asks on demand, because installed-ness changes elsewhere', async () => {
    const { result } = renderHook(() => useAsrReadiness())
    await waitFor(() => expect(bridge.readiness).toHaveBeenCalledTimes(1))

    bridge.readiness.mockResolvedValue(asrReadinessFixture({ installed: true }))
    await act(async () => result.current.refresh())
    expect(result.current.readiness?.installed).toBe(true)
  })

  it('takes the readiness the delete resulted in, rather than guessing', async () => {
    bridge.readiness.mockResolvedValue(asrReadinessFixture({ installed: true }))
    bridge.deleteModel.mockResolvedValue(asrReadinessFixture({ installed: false }))
    const { result } = renderHook(() => useAsrReadiness())
    await waitFor(() => expect(result.current.readiness?.installed).toBe(true))

    await act(async () => {
      await result.current.remove()
    })
    expect(result.current.readiness?.installed).toBe(false)
  })

  /**
   * The delete can genuinely fail — Windows refuses to unlink a weight file the
   * engine still has open — so the rejection has to reach the caller rather
   * than being swallowed into a `void`.
   */
  it('lets a failed delete reject, so a screen can say so', async () => {
    bridge.deleteModel.mockRejectedValue(new Error('EBUSY'))
    const { result } = renderHook(() => useAsrReadiness())
    await waitFor(() => expect(result.current.readiness).not.toBeNull())
    await expect(result.current.remove()).rejects.toThrow('EBUSY')
  })

  it('drops a late answer once the surface is gone', async () => {
    let resolve: (value: unknown) => void = () => {}
    bridge.readiness.mockReturnValue(new Promise((r) => (resolve = r)))
    const { unmount } = renderHook(() => useAsrReadiness())
    unmount()
    // No state write after unmount: the effect's `cancelled` flag is the whole
    // reason it exists.
    expect(() => resolve(asrReadinessFixture())).not.toThrow()
  })
})

describe('useAsrInstalled', () => {
  beforeEach(() => {
    const bridge = createHiveAsrMock()
    bridge.readiness.mockResolvedValue(asrReadinessFixture({ installed: true }))
    window.hive = { ...window.hive, asr: bridge } as unknown as typeof window.hive
  })

  afterEach(cleanup)

  it('collapses "not asked yet" into false, which is safe for a gate', async () => {
    const { result } = renderHook(() => useAsrInstalled())
    // No take can start during the round trip either, so the two collapse.
    expect(result.current).toBe(false)
    await waitFor(() => expect(result.current).toBe(true))
  })
})
