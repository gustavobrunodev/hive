// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useUpdateFlow } from './useUpdateFlow'
import type { UpdateEventIn } from './updateFlow'

/**
 * `useUpdateFlow` (npm-distribution T14) — the single shared source of
 * update-flow truth: launch + periodic silent checks, skip suppression, and
 * everything `UpdateNotice`/the rail's ambient dot (T12) read from.
 */

interface AppInfoStub {
  name: string
  version: string
  updatesSupported: boolean
  canApply: boolean
  lastCheckedAt: number | null
  skippedVersion: string | null
}

function defaultInfo(overrides: Partial<AppInfoStub> = {}): AppInfoStub {
  return {
    name: 'hive-desktop',
    version: '0.1.0',
    updatesSupported: true,
    canApply: true,
    lastCheckedAt: null,
    skippedVersion: null,
    ...overrides
  }
}

/** Installs a controllable `window.hive.app` stub, mirroring `UpdateCenter.test.ts`'s harness. `checkForUpdates` defaults to resolving immediately, matching the real bridge's Promise<void> shape. */
function stubHive(
  info: AppInfoStub,
  options: { hangCheck?: boolean } = {}
): {
  emit: (event: UpdateEventIn) => void
  checkForUpdates: ReturnType<typeof vi.fn>
  downloadUpdate: ReturnType<typeof vi.fn>
  installUpdate: ReturnType<typeof vi.fn>
  cancelUpdate: ReturnType<typeof vi.fn>
  revealInstaller: ReturnType<typeof vi.fn>
  skipVersion: ReturnType<typeof vi.fn>
} {
  let listener: ((event: UpdateEventIn) => void) | null = null
  const checkForUpdates = options.hangCheck
    ? vi.fn(() => new Promise<void>(() => {})) // never resolves — proves nothing awaits it
    : vi.fn(async () => undefined)
  const downloadUpdate = vi.fn(async () => undefined)
  const installUpdate = vi.fn(async () => undefined)
  const cancelUpdate = vi.fn(async () => undefined)
  const revealInstaller = vi.fn(async () => undefined)
  const skipVersion = vi.fn(async () => undefined)

  vi.stubGlobal('hive', {
    app: {
      info: vi.fn(async () => info),
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      cancelUpdate,
      revealInstaller,
      skipVersion,
      onUpdateEvent: vi.fn((cb: (event: UpdateEventIn) => void) => {
        listener = cb
        return () => {
          listener = null
        }
      })
    }
  })

  return {
    emit: (event: UpdateEventIn) => listener?.(event),
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelUpdate,
    revealInstaller,
    skipVersion
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useUpdateFlow — launch + periodic checks (ND-R2.3/ND-R2.5)', () => {
  it('fires one silent (explicit:false) check on mount', () => {
    const hive = stubHive(defaultInfo())
    renderHook(() => useUpdateFlow())
    expect(hive.checkForUpdates).toHaveBeenCalledWith(false)
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('re-checks silently on the periodic interval, and stops once unmounted', () => {
    vi.useFakeTimers()
    const hive = stubHive(defaultInfo())
    const { unmount } = renderHook(() => useUpdateFlow())
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(45 * 60 * 1000)
    })
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(2)
    expect(hive.checkForUpdates).toHaveBeenLastCalledWith(false)

    act(() => {
      vi.advanceTimersByTime(45 * 60 * 1000)
    })
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(3)

    unmount()
    act(() => {
      vi.advanceTimersByTime(45 * 60 * 1000)
    })
    // No further calls after unmount — the interval was cleared.
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(3)
  })

  it('never awaits the check — the hook resolves synchronously even if checkForUpdates never resolves (proves it cannot delay/reorder a caller like the onboarding gate, ND-R2.5)', () => {
    stubHive(defaultInfo(), { hangCheck: true })
    const { result } = renderHook(() => useUpdateFlow())
    // If mounting this hook awaited the check in any way, `result.current`
    // would never be populated within this synchronous test body.
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(result.current.pending).toBe(false)
  })
})

describe('useUpdateFlow — app info', () => {
  it('loads currentVersion/canApply from app:info', async () => {
    stubHive(defaultInfo({ version: '0.1.0', canApply: true }))
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => {
      expect(result.current.currentVersion).toBe('0.1.0')
    })
    expect(result.current.canApply).toBe(true)
  })
})

describe('useUpdateFlow — event -> state, and the ambient-dot "pending" derivation (T12)', () => {
  it('idle/checking/upToDate are not pending; available/downloading/verifying/downloaded/applying/error all are', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    expect(result.current.pending).toBe(false)

    act(() => hive.emit({ type: 'checking' }))
    expect(result.current.pending).toBe(false)

    act(() => hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null }))
    expect(result.current.state).toEqual({
      status: 'available',
      version: '0.2.0',
      bytes: null,
      notes: null
    })
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'progress', percent: 10, transferred: 10, total: 100 }))
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'verifying' }))
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' }))
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'applying' }))
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'error', message: 'x', kind: 'network' }))
    expect(result.current.pending).toBe(true)

    act(() => hive.emit({ type: 'not-available' }))
    expect(result.current.pending).toBe(false)
  })
})

describe('useUpdateFlow — skip suppression (ND-R5.4) and never auto-downloading (ND-R5.1)', () => {
  it('suppresses an available event for the already-skipped version (persisted, even across a fresh mount)', async () => {
    const hive = stubHive(defaultInfo({ skippedVersion: '0.2.0' }))
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null }))
    // Never surfaced as `available` — state stays whatever it was (idle).
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(result.current.pending).toBe(false)
    expect(hive.downloadUpdate).not.toHaveBeenCalled()
  })

  it('still announces a genuinely newer version than the one skipped', async () => {
    const hive = stubHive(defaultInfo({ skippedVersion: '0.2.0' }))
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => hive.emit({ type: 'available', version: '0.3.0', bytes: null, notes: null }))
    expect(result.current.state.status).toBe('available')
    expect(result.current.pending).toBe(true)
  })

  it('a launch check discovering an available version never triggers a download on its own', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null }))
    expect(result.current.state.status).toBe('available')
    expect(hive.downloadUpdate).not.toHaveBeenCalled()

    // Only an explicit updateNow() call ever triggers it.
    act(() => result.current.updateNow())
    expect(hive.downloadUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('useUpdateFlow — actions', () => {
  it('updateNow: downloads from available, installs from downloaded, no-ops otherwise', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => result.current.updateNow())
    expect(hive.downloadUpdate).not.toHaveBeenCalled()
    expect(hive.installUpdate).not.toHaveBeenCalled()

    act(() => hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null }))
    act(() => result.current.updateNow())
    expect(hive.downloadUpdate).toHaveBeenCalledTimes(1)

    act(() => hive.emit({ type: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' }))
    act(() => result.current.updateNow())
    expect(hive.installUpdate).toHaveBeenCalledTimes(1)
  })

  it('skip: persists the exact pending version and clears pending immediately', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null }))
    expect(result.current.pending).toBe(true)

    act(() => result.current.skip())
    expect(hive.skipVersion).toHaveBeenCalledWith('0.2.0')
    expect(result.current.pending).toBe(false)
    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('skip is a no-op outside the available state', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => result.current.skip())
    expect(hive.skipVersion).not.toHaveBeenCalled()
  })

  it('cancel/retry/openInstaller/notNow call through as expected', async () => {
    const hive = stubHive(defaultInfo())
    const { result } = renderHook(() => useUpdateFlow())
    await waitFor(() => expect(result.current.currentVersion).toBe('0.1.0'))

    act(() => result.current.cancel())
    expect(hive.cancelUpdate).toHaveBeenCalledTimes(1)

    act(() => result.current.retry())
    // The explicit check (`true`) — distinct from the silent launch/periodic
    // ones, and matching UpdateCenter's identical "Tentar de novo" choice.
    expect(hive.checkForUpdates).toHaveBeenLastCalledWith(true)

    act(() => result.current.openInstaller())
    expect(hive.revealInstaller).toHaveBeenCalledTimes(1)

    // notNow is intentionally a no-op (session dismissal is UpdateNotice's
    // own concern) — just proving it doesn't throw or call anything.
    expect(() => act(() => result.current.notNow())).not.toThrow()
  })
})
