// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useClaudeAuth } from './useClaudeAuth'
import {
  claudeLoginStateFixture,
  claudeSignedOutFixture,
  claudeStatusFixture,
  createHiveClaudeAuthMock
} from '../testSupport/hiveClaudeAuthMock'

/**
 * The hook every Claude-account surface reads. Its whole job is the split
 * between the two sources: `status` costs a **process** (measured at 5.9 s
 * against a Windows npm shim), so it is read once and never polled; `login` is
 * a subscribed stream of something happening now. A landed sign-in has to
 * correct the first one at once, and with `force` — otherwise the panel that
 * just said "connected" keeps drawing main's cached "signed out".
 */

type StateListener = (state: ReturnType<typeof claudeLoginStateFixture>) => void

function install(overrides: Partial<ReturnType<typeof createHiveClaudeAuthMock>> = {}): {
  claudeAuth: ReturnType<typeof createHiveClaudeAuthMock>
  emit: (state: Parameters<StateListener>[0]) => void
} {
  const listeners: StateListener[] = []
  const claudeAuth = {
    ...createHiveClaudeAuthMock(),
    onState: vi.fn((listener: StateListener) => {
      listeners.push(listener)
      return () => {
        listeners.splice(listeners.indexOf(listener), 1)
      }
    }),
    ...overrides
  }
  ;(window as unknown as { hive: { claudeAuth: typeof claudeAuth } }).hive = { claudeAuth }
  return {
    claudeAuth,
    emit: (state: Parameters<StateListener>[0]) => listeners.forEach((listener) => listener(state))
  }
}

afterEach(cleanup)

describe('useClaudeAuth', () => {
  it('starts with no status — not with a fact it has not read yet', () => {
    install()
    const { result } = renderHook(() => useClaudeAuth())
    expect(result.current.status).toBeNull()
    expect(result.current.login.phase).toBe('idle')
  })

  it('reads the machine once on mount, scoped to the workspace and taking the cache', async () => {
    const { claudeAuth } = install()
    const { result } = renderHook(() => useClaudeAuth(true, '/work'))
    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(claudeAuth.status).toHaveBeenCalledWith('/work', false)
    expect(claudeAuth.status).toHaveBeenCalledTimes(1)
  })

  it('reads nothing at all while inactive — the probe is a spawn, not a getter', () => {
    const { claudeAuth } = install()
    renderHook(() => useClaudeAuth(false))
    expect(claudeAuth.status).not.toHaveBeenCalled()
    expect(claudeAuth.onState).not.toHaveBeenCalled()
  })

  it('follows the live sign-in, and re-reads the account when one ends', async () => {
    const { claudeAuth, emit } = install({
      status: vi
        .fn()
        .mockResolvedValueOnce(claudeSignedOutFixture())
        .mockResolvedValue(claudeStatusFixture())
    })
    const { result } = renderHook(() => useClaudeAuth())
    await waitFor(() => expect(result.current.status?.state).toBe('signed-out'))

    act(() => emit(claudeLoginStateFixture({ phase: 'code', url: 'https://claude.com/x' })))
    expect(result.current.login).toMatchObject({ phase: 'code', url: 'https://claude.com/x' })

    act(() => emit(claudeLoginStateFixture({ phase: 'success' })))
    await waitFor(() => expect(result.current.status?.state).toBe('connected'))
    // …and with `force`, because main's cache still holds the signed-out read.
    expect(claudeAuth.status).toHaveBeenLastCalledWith(undefined, true)
  })

  it('re-reads after a failed or cancelled attempt too — a terminal login may have landed', async () => {
    const { claudeAuth, emit } = install()
    renderHook(() => useClaudeAuth())
    await waitFor(() => expect(claudeAuth.status).toHaveBeenCalled())

    act(() => emit(claudeLoginStateFixture({ phase: 'failed', message: 'boom' })))
    act(() => emit(claudeLoginStateFixture({ phase: 'canceled' })))
    await waitFor(() => expect(claudeAuth.status).toHaveBeenCalledTimes(3))
  })

  it('ignores a phase that is still in flight — nothing to re-read yet', async () => {
    const { claudeAuth, emit } = install()
    renderHook(() => useClaudeAuth())
    await waitFor(() => expect(claudeAuth.status).toHaveBeenCalledTimes(1))
    act(() => emit(claudeLoginStateFixture({ phase: 'browser' })))
    expect(claudeAuth.status).toHaveBeenCalledTimes(1)
  })

  it('starts a sign-in and re-reads the account when it comes back', async () => {
    const { claudeAuth } = install()
    const { result } = renderHook(() => useClaudeAuth(true, '/work'))
    await waitFor(() => expect(result.current.status).not.toBeNull())

    await act(async () => {
      result.current.connect('console')
    })
    expect(claudeAuth.login).toHaveBeenCalledWith('console', '/work')
    await waitFor(() => expect(claudeAuth.status).toHaveBeenLastCalledWith('/work', true))
  })

  it('passes a pasted code and a cancel straight through to main', async () => {
    const { claudeAuth } = install()
    const { result } = renderHook(() => useClaudeAuth())
    await waitFor(() => expect(claudeAuth.status).toHaveBeenCalled())

    act(() => result.current.submitCode('cod-9f21'))
    expect(claudeAuth.submitCode).toHaveBeenCalledWith('cod-9f21')
    act(() => result.current.cancel())
    expect(claudeAuth.cancel).toHaveBeenCalled()
  })

  it('does not let a stale initial read overwrite a sign-in already under way', async () => {
    // The mount-time `loginState()` and the subscription race, and the read can
    // land second: without the guard the beacon would blink out mid-sign-in.
    let resolveInitial: (state: ReturnType<typeof claudeLoginStateFixture>) => void = () => {}
    const { emit } = install({
      loginState: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveInitial = resolve
          })
      )
    })
    const { result } = renderHook(() => useClaudeAuth())
    act(() => emit(claudeLoginStateFixture({ phase: 'browser' })))
    await act(async () => {
      resolveInitial(claudeLoginStateFixture())
    })
    expect(result.current.login.phase).toBe('browser')
  })
})
