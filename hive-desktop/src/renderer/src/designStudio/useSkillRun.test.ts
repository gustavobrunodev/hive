// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useSkillRun } from './useSkillRun'
import type { StudioSkillEvent } from './skillRun'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/**
 * design-studio T6.2 — DS-R2 ("toda a espera assíncrona é coberta por estado de
 * carregamento visível") and DS-R17 (a `retryable: true` the user can actually
 * act on).
 *
 * The bridge is a fake that hands the test the emitter, so the *ordering* the
 * user experiences is what is asserted — not that a mock was called.
 */

const REQUEST = {
  kind: 'generate' as const,
  workspace: '/ws',
  specPath: 'ux.md',
  screenTitle: 'Login'
}

/** Installs a `runSkill` the test drives by hand, and reports every request it saw. */
function mockRunSkill(): {
  requests: unknown[]
  emit: (event: StudioSkillEvent) => void
  stopped: number
} {
  const noop = (): void => {}
  const state = {
    requests: [] as unknown[],
    emit: noop as (event: StudioSkillEvent) => void,
    stopped: 0
  }
  window.hive = {
    designStudio: {
      runSkill: (request: unknown, onEvent: (event: StudioSkillEvent) => void) => {
        state.requests.push(request)
        state.emit = onEvent
        return () => {
          state.stopped += 1
        }
      }
    }
  } as unknown as typeof window.hive
  return state
}

describe('useSkillRun (DS-R2)', () => {
  it('is already waiting the moment the run starts, before any event arrives', () => {
    mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))

    expect(result.current.running).toBe(false)
    act(() => result.current.start(REQUEST))

    expect(result.current.phase).toBe('reading')
    expect(result.current.running).toBe(true)
  })

  it('follows the turn through its phases', () => {
    const bridge = mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))
    act(() => result.current.start(REQUEST))

    act(() => bridge.emit({ type: 'status', phase: 'choosing' }))
    expect(result.current.phase).toBe('choosing')

    act(() => bridge.emit({ type: 'status', phase: 'composing' }))
    expect(result.current.phase).toBe('composing')
  })

  it('hands the batch over and stops waiting when the turn lands', () => {
    const bridge = mockRunSkill()
    const onBatch = vi.fn()
    const { result } = renderHook(() => useSkillRun(onBatch))
    act(() => result.current.start(REQUEST))

    const batch = {
      commands: [{ type: 'RemoveComponent' as const, componentId: 'n1' }],
      message: 'pronto'
    }
    act(() => bridge.emit({ type: 'result', batch }))

    expect(onBatch).toHaveBeenCalledWith(batch)
    expect(result.current.running).toBe(false)
    expect(result.current.error).toBeNull()
    // The stream is closed once, not left forwarding into a finished run.
    expect(bridge.stopped).toBe(1)
  })

  it('keeps a failure as a value, stops waiting, and never calls the batch handler', () => {
    const bridge = mockRunSkill()
    const onBatch = vi.fn()
    const { result } = renderHook(() => useSkillRun(onBatch))
    act(() => result.current.start(REQUEST))

    const error = {
      kind: 'operation' as const,
      scope: 'agent' as const,
      message: 'agente indisponível',
      retryable: true
    }
    act(() => bridge.emit({ type: 'failed', error }))

    expect(result.current.error).toEqual(error)
    expect(result.current.running).toBe(false)
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('retry re-invokes the same request — the button does the work, not just render', () => {
    const bridge = mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))
    act(() => result.current.start(REQUEST))
    act(() =>
      bridge.emit({
        type: 'failed',
        error: { kind: 'operation', scope: 'agent', message: 'timeout', retryable: true }
      })
    )

    act(() => result.current.retry())

    expect(bridge.requests).toEqual([REQUEST, REQUEST])
    expect(result.current.error).toBeNull()
    expect(result.current.phase).toBe('reading')
  })

  it('retry before anything ran is a no-op', () => {
    const bridge = mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))

    act(() => result.current.retry())

    expect(bridge.requests).toEqual([])
    expect(result.current.running).toBe(false)
  })

  it('dismissing the error clears it without starting anything', () => {
    const bridge = mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))
    act(() => result.current.start(REQUEST))
    act(() =>
      bridge.emit({
        type: 'failed',
        error: { kind: 'operation', scope: 'agent', message: 'x', retryable: false }
      })
    )

    act(() => result.current.dismissError())

    expect(result.current.error).toBeNull()
    expect(bridge.requests).toHaveLength(1)
  })

  it('starting a second run stops the first', () => {
    const bridge = mockRunSkill()
    const { result } = renderHook(() => useSkillRun(vi.fn()))
    act(() => result.current.start(REQUEST))
    act(() => result.current.start({ ...REQUEST, screenTitle: 'Cadastro' }))

    expect(bridge.stopped).toBe(1)
    expect(bridge.requests).toHaveLength(2)
  })

  it('stops the run when the tab goes away', () => {
    const bridge = mockRunSkill()
    const { result, unmount } = renderHook(() => useSkillRun(vi.fn()))
    act(() => result.current.start(REQUEST))

    unmount()

    expect(bridge.stopped).toBe(1)
  })
})
