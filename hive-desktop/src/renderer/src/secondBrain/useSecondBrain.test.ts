// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { useSecondBrain } from './useSecondBrain'

function mockGetVault(status: { path: string | null; name: string | null; rawPending: number }): {
  getVault: ReturnType<typeof vi.fn>
} {
  const getVault = vi.fn().mockResolvedValue(status)
  window.hive = {
    ...window.hive,
    secondBrain: { ...window.hive?.secondBrain, getVault }
  } as typeof window.hive
  return { getVault }
}

describe('useSecondBrain', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('exposes the vault status and derives hasVault (no vault → empty state)', async () => {
    mockGetVault({ path: null, name: null, rawPending: 0 })
    const { result } = renderHook(() => useSecondBrain('/ws'))

    await waitFor(() => expect(result.current.hasVault).toBe(false))
    expect(result.current.vaultPath).toBeNull()
    expect(result.current.rawPending).toBe(0)
  })

  it('reflects a present vault and its raw-pending count', async () => {
    mockGetVault({ path: '/ws/second-brain', name: 'second-brain', rawPending: 4 })
    const { result } = renderHook(() => useSecondBrain('/ws'))

    await waitFor(() => expect(result.current.hasVault).toBe(true))
    expect(result.current.vaultPath).toBe('/ws/second-brain')
    expect(result.current.vaultName).toBe('second-brain')
    expect(result.current.rawPending).toBe(4)
  })

  it('refresh re-fetches the vault status', async () => {
    const { getVault } = mockGetVault({ path: null, name: null, rawPending: 0 })
    const { result } = renderHook(() => useSecondBrain('/ws'))
    await waitFor(() => expect(getVault).toHaveBeenCalledTimes(1))

    getVault.mockResolvedValueOnce({
      path: '/ws/second-brain',
      name: 'second-brain',
      rawPending: 1
    })
    result.current.refresh()
    await waitFor(() => expect(result.current.rawPending).toBe(1))
  })

  it('reads as empty for a since-switched workspace until the new status lands', async () => {
    mockGetVault({ path: '/a/second-brain', name: 'second-brain', rawPending: 2 })
    const { result, rerender } = renderHook(({ ws }) => useSecondBrain(ws), {
      initialProps: { ws: '/a' }
    })
    await waitFor(() => expect(result.current.rawPending).toBe(2))

    // Switch workspace: the tagged state no longer matches, so it reads empty
    // until the fresh fetch resolves.
    rerender({ ws: '/b' })
    await waitFor(() => expect(result.current.workspace).toBe('/b'))
    await waitFor(() => expect(result.current.rawPending).toBe(2)) // /b's fetch lands
  })
})
