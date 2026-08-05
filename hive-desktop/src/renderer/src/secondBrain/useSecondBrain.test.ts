// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'
import { useSecondBrain, type VaultHealth } from './useSecondBrain'
import { FRESH_HEALTH } from '../testSupport/hiveSecondBrainMock'

interface Bridge {
  /** Fires one fs change to every live `watchWorkspaceShared` listener. */
  emitFsChange: () => void
  getVault: ReturnType<typeof vi.fn>
  getHealth: ReturnType<typeof vi.fn>
  noteIngest: ReturnType<typeof vi.fn>
  noteLint: ReturnType<typeof vi.fn>
  snoozeHealth: ReturnType<typeof vi.fn>
}

function mockBridge(
  status: { path: string | null; name: string | null; rawPending: number },
  health: VaultHealth = FRESH_HEALTH
): Bridge {
  const bridge: Bridge = {
    emitFsChange: () => {},
    getVault: vi.fn().mockResolvedValue(status),
    getHealth: vi.fn().mockResolvedValue(health),
    noteIngest: vi.fn().mockResolvedValue({ ...health, ingestsSinceLint: 1 }),
    noteLint: vi.fn().mockResolvedValue({ ...health, ingestsSinceLint: 0, due: false }),
    snoozeHealth: vi.fn().mockResolvedValue({ ...health, due: false })
  }
  const sinks: Array<(change: { type: string; path: string }) => void> = []
  window.hive = {
    ...window.hive,
    watchWorkspace: vi.fn(
      (_root: string, onChange: (change: { type: string; path: string }) => void) => {
        sinks.push(onChange)
        return () => {
          const index = sinks.indexOf(onChange)
          if (index >= 0) sinks.splice(index, 1)
        }
      }
    ),
    secondBrain: { ...window.hive?.secondBrain, ...bridge }
  } as unknown as typeof window.hive
  bridge.emitFsChange = () => {
    for (const sink of [...sinks]) sink({ type: 'add', path: 'second-brain/wiki/index.md' })
  }
  return bridge
}

describe('useSecondBrain', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('exposes the vault status and derives hasVault (no vault → empty state)', async () => {
    mockBridge({ path: null, name: null, rawPending: 0 })
    const { result } = renderHook(() => useSecondBrain('/ws'))

    await waitFor(() => expect(result.current.health).not.toBeNull())
    expect(result.current.hasVault).toBe(false)
    expect(result.current.vaultPath).toBeNull()
    expect(result.current.rawPending).toBe(0)
  })

  it('reflects a present vault and its raw-pending count', async () => {
    mockBridge({ path: '/ws/second-brain', name: 'second-brain', rawPending: 4 })
    const { result } = renderHook(() => useSecondBrain('/ws'))

    await waitFor(() => expect(result.current.hasVault).toBe(true))
    expect(result.current.vaultPath).toBe('/ws/second-brain')
    expect(result.current.vaultName).toBe('second-brain')
    expect(result.current.rawPending).toBe(4)
  })

  it('fetches the health cadence alongside the vault (SB-R10.1)', async () => {
    const { getHealth } = mockBridge(
      { path: '/ws/second-brain', name: 'second-brain', rawPending: 0 },
      { ...FRESH_HEALTH, ingestsSinceLint: 7 }
    )
    const { result } = renderHook(() => useSecondBrain('/ws'))

    await waitFor(() => expect(result.current.health?.ingestsSinceLint).toBe(7))
    expect(getHealth).toHaveBeenCalledWith('/ws')
  })

  it('refresh re-fetches the vault status', async () => {
    const { getVault } = mockBridge({ path: null, name: null, rawPending: 0 })
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

  it('picks the vault up as soon as the agent writes it, without a click (the "Configure a base primeiro" bug)', async () => {
    vi.useFakeTimers()
    try {
      const bridge = mockBridge({ path: null, name: null, rawPending: 0 })
      const { result } = renderHook(() => useSecondBrain('/ws'))
      await vi.waitFor(() => expect(result.current.health).not.toBeNull())
      expect(result.current.hasVault).toBe(false)

      // `/second-brain` finishes: the vault appears on disk and the workspace
      // watcher reports the write.
      bridge.getVault.mockResolvedValue({
        path: '/ws/second-brain',
        name: 'second-brain',
        rawPending: 0
      })
      act(() => bridge.emitFsChange())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(result.current.hasVault).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('coalesces a burst of fs events into one re-probe', async () => {
    vi.useFakeTimers()
    try {
      const bridge = mockBridge({ path: null, name: null, rawPending: 0 })
      renderHook(() => useSecondBrain('/ws'))
      await vi.waitFor(() => expect(bridge.getVault).toHaveBeenCalledTimes(1))

      act(() => {
        bridge.emitFsChange()
        bridge.emitFsChange()
        bridge.emitFsChange()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(bridge.getVault).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-probes on window focus — the base may have been created outside Hive', async () => {
    vi.useFakeTimers()
    try {
      const bridge = mockBridge({ path: null, name: null, rawPending: 0 })
      renderHook(() => useSecondBrain('/ws'))
      await vi.waitFor(() => expect(bridge.getVault).toHaveBeenCalledTimes(1))

      act(() => {
        window.dispatchEvent(new Event('focus'))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(bridge.getVault).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('records an ingest and adopts the health the main process recomputed (SB-R10.2)', async () => {
    const { noteIngest } = mockBridge({ path: '/ws/kb', name: 'kb', rawPending: 0 })
    const { result } = renderHook(() => useSecondBrain('/ws'))
    await waitFor(() => expect(result.current.health).not.toBeNull())

    act(() => result.current.noteIngest())
    await waitFor(() => expect(result.current.health?.ingestsSinceLint).toBe(1))
    expect(noteIngest).toHaveBeenCalledWith('/ws')
  })

  it('records a health-check and a snooze through the same one-round-trip path (SB-R10.3/10.5)', async () => {
    const due = { ...FRESH_HEALTH, ingestsSinceLint: 10, reason: 'ingests' as const, due: true }
    const { noteLint, snoozeHealth } = mockBridge(
      { path: '/ws/kb', name: 'kb', rawPending: 0 },
      due
    )
    const { result } = renderHook(() => useSecondBrain('/ws'))
    await waitFor(() => expect(result.current.health?.due).toBe(true))

    act(() => result.current.snoozeHealth())
    await waitFor(() => expect(result.current.health?.due).toBe(false))
    expect(snoozeHealth).toHaveBeenCalledWith('/ws')

    act(() => result.current.noteLint())
    await waitFor(() => expect(result.current.health?.ingestsSinceLint).toBe(0))
    expect(noteLint).toHaveBeenCalledWith('/ws')
  })

  it('drops an in-flight cadence update that belongs to a since-switched workspace', async () => {
    const bridge = mockBridge({ path: '/a/kb', name: 'kb', rawPending: 2 })
    // The note resolves only after the test switches workspaces.
    let resolveNote: (health: VaultHealth) => void = () => {}
    bridge.noteIngest.mockReturnValueOnce(
      new Promise<VaultHealth>((resolve) => {
        resolveNote = resolve
      })
    )
    const { result, rerender } = renderHook(({ ws }) => useSecondBrain(ws), {
      initialProps: { ws: '/a' }
    })
    await waitFor(() => expect(result.current.health).not.toBeNull())

    act(() => result.current.noteIngest())
    rerender({ ws: '/b' })
    await act(async () => {
      resolveNote({ ...FRESH_HEALTH, ingestsSinceLint: 99 })
    })

    // /b's own fetch wins; /a's stale cadence never paints.
    expect(result.current.health?.ingestsSinceLint).toBe(0)
  })

  it('reads as empty for a since-switched workspace until the new status lands', async () => {
    mockBridge({ path: '/a/second-brain', name: 'second-brain', rawPending: 2 })
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
