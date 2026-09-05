// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAwsSession } from './useAwsSession'
import {
  awsLoginStateFixture,
  awsReadyFixture,
  createHiveAwsMock
} from '../testSupport/hiveAwsMock'

/**
 * The hook that every AWS surface reads. Its whole job is the split between
 * the two sources: `status` is a **polled** fact about disk, `login` is a
 * **subscribed** stream of something happening now — and a landed login has to
 * correct the first one immediately, or the panel that just said "connected"
 * keeps showing "expired" for up to a minute.
 */

type StateListener = (state: ReturnType<typeof awsLoginStateFixture>) => void

function install(overrides: Partial<ReturnType<typeof createHiveAwsMock>> = {}): {
  aws: ReturnType<typeof createHiveAwsMock>
  emit: (state: Parameters<StateListener>[0]) => void
} {
  const listeners: StateListener[] = []
  const aws = {
    ...createHiveAwsMock(awsReadyFixture()),
    onState: vi.fn((listener: StateListener) => {
      listeners.push(listener)
      return () => {
        listeners.splice(listeners.indexOf(listener), 1)
      }
    }),
    ...overrides
  }
  ;(window as unknown as { hive: { aws: typeof aws } }).hive = { aws }
  return { aws, emit: (state: Parameters<StateListener>[0]) => listeners.forEach((l) => l(state)) }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('useAwsSession', () => {
  it('starts with no status — not with a fact it has not read yet', () => {
    install()
    const { result } = renderHook(() => useAwsSession())
    expect(result.current.status).toBeNull()
    expect(result.current.login.phase).toBe('idle')
  })

  it('reads the machine on mount, scoped to the workspace', async () => {
    const { aws } = install()
    const { result } = renderHook(() => useAwsSession(true, '/work'))
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(aws.status).toHaveBeenCalledWith('/work')
  })

  it('does nothing at all while inactive — a closed sheet costs no reads', () => {
    const { aws } = install()
    renderHook(() => useAwsSession(false))
    expect(aws.status).not.toHaveBeenCalled()
    expect(aws.onState).not.toHaveBeenCalled()
  })

  it('re-reads the countdown on its own, since a session expires with nobody watching', async () => {
    const { aws } = install()
    renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(aws.status).toHaveBeenCalledTimes(2)
  })

  it('follows the live login stream', async () => {
    const { emit } = install()
    const { result } = renderHook(() => useAwsSession())
    await act(async () => {
      emit(awsLoginStateFixture({ phase: 'browser', url: 'https://x/authorize' }))
    })
    expect(result.current.login.phase).toBe('browser')
    expect(result.current.login.url).toBe('https://x/authorize')
  })

  it('re-reads the status the instant a login lands', async () => {
    // Without this the surface that just said "conectado" keeps showing
    // "expirada" until the next poll.
    const { aws, emit } = install()
    renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    await act(async () => {
      emit(awsLoginStateFixture({ phase: 'success' }))
    })
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(2))
  })

  it('re-reads after a failed or cancelled attempt too, not only a successful one', async () => {
    const { aws, emit } = install()
    renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    await act(async () => {
      emit(awsLoginStateFixture({ phase: 'failed', message: 'boom' }))
    })
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(2))
    await act(async () => {
      emit(awsLoginStateFixture({ phase: 'canceled' }))
    })
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(3))
  })

  it('does not re-read for a phase that is merely in progress', async () => {
    const { aws, emit } = install()
    renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    await act(async () => {
      emit(awsLoginStateFixture({ phase: 'browser', url: 'https://x' }))
    })
    expect(aws.status).toHaveBeenCalledTimes(1)
  })

  it('starts a login and re-reads when it resolves', async () => {
    const { aws } = install()
    const { result } = renderHook(() => useAwsSession(true, '/work'))
    await waitFor(() => expect(result.current.status).not.toBeNull())
    await act(async () => {
      result.current.connect('acme-prod')
    })
    expect(aws.login).toHaveBeenCalledWith('acme-prod', '/work')
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(2))
  })

  it('pins a profile and re-reads, so the panel shows the profile it just switched to', async () => {
    const { aws } = install()
    const { result } = renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    await act(async () => {
      result.current.chooseProfile('acme-prod')
    })
    expect(aws.setProfile).toHaveBeenCalledWith('acme-prod')
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(2))
  })

  it('cancels through the bridge', () => {
    const { aws } = install()
    const { result } = renderHook(() => useAwsSession())
    result.current.cancel()
    expect(aws.cancel).toHaveBeenCalled()
  })

  it('unsubscribes and stops polling on unmount', async () => {
    const { aws } = install()
    const { unmount } = renderHook(() => useAwsSession())
    await waitFor(() => expect(aws.status).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })
    expect(aws.status).toHaveBeenCalledTimes(1)
  })
})
