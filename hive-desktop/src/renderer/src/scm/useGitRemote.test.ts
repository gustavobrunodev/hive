// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useGitRemote } from './useGitRemote'
import { createGitStore, makeStatus } from '../testSupport/gitStoreMock'

afterEach(() => {
  cleanup()
})

describe('useGitRemote', () => {
  it('runs fetch/pull/push and reports a success toast', async () => {
    const store = createGitStore()
    const { result } = renderHook(() => useGitRemote(store))

    act(() => result.current.fetch())
    await waitFor(() => expect(result.current.result).toMatchObject({ type: 'success' }))
    expect(store.fetch).toHaveBeenCalled()

    act(() => result.current.pull())
    await waitFor(() => expect(store.pull).toHaveBeenCalled())
    act(() => result.current.push())
    await waitFor(() => expect(store.push).toHaveBeenCalled())
  })

  it('syncs when there is an upstream and publishes when there is not', async () => {
    const withUpstream = createGitStore({ status: makeStatus({ upstream: 'origin/main' }) })
    const a = renderHook(() => useGitRemote(withUpstream))
    act(() => a.result.current.sync())
    await waitFor(() => expect(withUpstream.sync).toHaveBeenCalled())
    expect(withUpstream.publish).not.toHaveBeenCalled()

    const noUpstream = createGitStore({ status: makeStatus({ upstream: null }) })
    const b = renderHook(() => useGitRemote(noUpstream))
    act(() => b.result.current.sync())
    await waitFor(() => expect(noUpstream.publish).toHaveBeenCalled())
    expect(noUpstream.sync).not.toHaveBeenCalled()
  })

  it('surfaces git stderr as an error toast (D-GIT-1) and clears it', async () => {
    const store = createGitStore()
    store.push = vi.fn().mockRejectedValue({ stderr: 'fatal: Authentication failed' })
    const { result } = renderHook(() => useGitRemote(store))

    act(() => result.current.push())
    await waitFor(() =>
      expect(result.current.result).toMatchObject({
        type: 'error',
        detail: 'fatal: Authentication failed'
      })
    )

    act(() => result.current.clear())
    expect(result.current.result).toBeNull()
  })

  it('tolerates an error without stderr (detail omitted)', async () => {
    const store = createGitStore()
    store.fetch = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useGitRemote(store))
    act(() => result.current.fetch())
    await waitFor(() => expect(result.current.result?.type).toBe('error'))
    expect(result.current.result?.detail).toBeUndefined()
  })
})
