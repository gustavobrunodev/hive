// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useLegacyModels } from './useLegacyModels'
import { createHiveAsrMock } from '../testSupport/hiveAsrMock'

/**
 * The pre-M29 Whisper store, as space the user can choose to free.
 *
 * Deliberately not a migration: what is on disk is a download someone waited
 * twenty minutes for, often gigabytes of it, and deleting it on first launch
 * after an update is a surprise with no undo.
 */

describe('useLegacyModels', () => {
  let bridge: ReturnType<typeof createHiveAsrMock>

  beforeEach(() => {
    bridge = createHiveAsrMock()
    window.hive = { ...window.hive, asr: bridge } as unknown as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('answers null until main has measured, then the real figure', async () => {
    bridge.legacyModelBytes.mockResolvedValue(1_500_000_000)
    const { result } = renderHook(() => useLegacyModels())
    // `null` is "not measured yet" — a surface that read it as `0` would hide
    // the offer for exactly as long as the round trip takes.
    expect(result.current.bytes).toBeNull()
    await waitFor(() => expect(result.current.bytes).toBe(1_500_000_000))
  })

  it('measures nothing on an install that never had the old store', async () => {
    const { result } = renderHook(() => useLegacyModels())
    await waitFor(() => expect(result.current.bytes).toBe(0))
  })

  it('asks nothing at all while the surface is closed', async () => {
    renderHook(() => useLegacyModels(false))
    await act(async () => {})
    expect(bridge.legacyModelBytes).not.toHaveBeenCalled()
  })

  it('takes the figure the delete left behind, rather than assuming zero', async () => {
    bridge.legacyModelBytes.mockResolvedValue(2_000_000_000)
    // Windows can refuse to unlink a file the previous engine still had open,
    // so "what is left" is main's answer, not the caller's optimism.
    bridge.removeLegacyModels.mockResolvedValue(4_096)
    const { result } = renderHook(() => useLegacyModels())
    await waitFor(() => expect(result.current.bytes).toBe(2_000_000_000))

    await act(async () => {
      await result.current.remove()
    })
    expect(result.current.bytes).toBe(4_096)
  })

  it('drops a late measurement once the surface is gone', () => {
    let resolve: (value: number) => void = () => {}
    bridge.legacyModelBytes.mockReturnValue(new Promise<number>((r) => (resolve = r)))
    const { unmount } = renderHook(() => useLegacyModels())
    unmount()
    expect(() => resolve(10)).not.toThrow()
  })
})
