// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useBrainSetup } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'

function store(overrides: Partial<SecondBrainStore> = {}): SecondBrainStore {
  return {
    workspace: '/ws',
    vaultPath: null,
    vaultName: null,
    rawPending: 0,
    hasVault: false,
    health: null,
    refresh: vi.fn(),
    noteIngest: vi.fn(),
    noteLint: vi.fn(),
    snoozeHealth: vi.fn(),
    ...overrides
  }
}

const WITH_VAULT = { hasVault: true, vaultPath: '/ws/second-brain', vaultName: 'second-brain' }

describe('useBrainSetup', () => {
  afterEach(() => cleanup())

  it('starts idle and launches /second-brain — the one launch every surface shares', () => {
    const launch = vi.fn()
    const { result } = renderHook(() => useBrainSetup(store(), launch))

    expect(result.current.phase).toBe('idle')
    act(() => result.current.start())

    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ prompt: '/second-brain' }) })
    )
    expect(result.current.phase).toBe('running')
  })

  it('flips to ready the moment the vault lands on disk (the store re-probing, not a timer)', () => {
    const launch = vi.fn()
    const { result, rerender } = renderHook(
      ({ hasVault }) => useBrainSetup(store(hasVault ? WITH_VAULT : {}), launch),
      {
        initialProps: { hasVault: false }
      }
    )

    act(() => result.current.start())
    expect(result.current.phase).toBe('running')

    rerender({ hasVault: true })
    expect(result.current.phase).toBe('ready')
  })

  it('dismiss acknowledges the hand-off and returns the panel to normal', () => {
    const { result, rerender } = renderHook(
      ({ hasVault }) => useBrainSetup(store(hasVault ? WITH_VAULT : {}), vi.fn()),
      {
        initialProps: { hasVault: false }
      }
    )

    act(() => result.current.start())
    rerender({ hasVault: true })
    expect(result.current.phase).toBe('ready')

    act(() => result.current.dismiss())
    expect(result.current.phase).toBe('idle')
  })

  it('recheck re-probes the disk — the escape hatch when a watcher missed the write', () => {
    const refresh = vi.fn()
    const { result } = renderHook(() => useBrainSetup(store({ refresh }), vi.fn()))

    act(() => result.current.recheck())
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not carry a setup in flight across a workspace switch', () => {
    const { result, rerender } = renderHook(
      ({ ws }) => useBrainSetup(store({ workspace: ws }), vi.fn()),
      {
        initialProps: { ws: '/ws' }
      }
    )

    act(() => result.current.start())
    expect(result.current.phase).toBe('running')

    rerender({ ws: '/other' })
    expect(result.current.phase).toBe('idle')
  })

  it('never celebrates a base that was already there', () => {
    const { result } = renderHook(() => useBrainSetup(store(WITH_VAULT), vi.fn()))
    expect(result.current.phase).toBe('idle')
  })
})
