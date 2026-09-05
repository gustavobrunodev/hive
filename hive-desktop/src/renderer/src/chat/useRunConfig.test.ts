// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useRunConfig } from './useRunConfig'
import { resetEnginePins } from './enginePins'
import { installRunConfigMock, RUN_CONFIG_CAPABILITIES } from '../testSupport/hiveRunConfigMock'

/**
 * The launcher's run-config: agent, model, effort — and what a launch carries.
 *
 * Driven directly rather than through one of the three surfaces that mount it,
 * because the branches that matter are awkward to reach from the outside: a
 * closed surface that must not probe anything, an agent switch that has to
 * reset a model id the new agent would reject, and a pin landing *after* the
 * surface already opened.
 */

const AGENTS = ['claude-cli', 'copilot-cli']

let bridge: ReturnType<typeof installRunConfigMock>

beforeEach(() => {
  bridge = installRunConfigMock()
})

afterEach(() => {
  // Unmount first: a hook still mounted when the bridge mock is restored keeps
  // calling a spy that no longer answers, which surfaces as an unhandled
  // rejection from an effect nobody is watching.
  cleanup()
  resetEnginePins()
  vi.restoreAllMocks()
})

describe('useRunConfig', () => {
  it('opens on the CLI default row and names the agent from the roster', async () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )

    await waitFor(() => expect(result.current.capabilities).not.toBeNull())
    expect(result.current.agentId).toBe('claude-cli')
    expect(result.current.model).toBe('')
    await waitFor(() =>
      expect(result.current.agents).toEqual([
        { id: 'claude-cli', displayName: 'Claude Code' },
        { id: 'copilot-cli', displayName: 'GitHub Copilot' }
      ])
    )
    expect(result.current.pin?.agentName).toBe('Claude Code')
  })

  it('probes nothing at all while the surface is closed', () => {
    renderHook(() => useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli', active: false }))

    expect(bridge.capabilities).not.toHaveBeenCalled()
    expect(bridge.agents).not.toHaveBeenCalled()
  })

  it('scopes detection to the workspace when it has one', async () => {
    renderHook(() => useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli', workspace: '/ws' }))

    await waitFor(() =>
      expect(bridge.capabilities).toHaveBeenCalledWith('claude-cli', { workspace: '/ws' })
    )
  })

  it('re-reads capabilities for the agent it switched to', async () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )
    await waitFor(() => expect(result.current.capabilities).not.toBeNull())

    act(() => result.current.setAgent('copilot-cli'))

    await waitFor(() => expect(bridge.capabilities).toHaveBeenCalledWith('copilot-cli'))
    expect(result.current.agentId).toBe('copilot-cli')
  })

  it('opens on the pinned model, even when the pin lands after the surface did', async () => {
    // The pin is read once per window, so a first open can beat it. Without
    // re-picking at that moment the setting would look ignored.
    let resolvePins: (
      value: Record<string, { model: string; effort: string | null }>
    ) => void = () => {}
    bridge.pins.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePins = resolve
      })
    )
    resetEnginePins()
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )
    await waitFor(() => expect(result.current.model).toBe(''))

    await act(async () => {
      resolvePins({ 'claude-cli': { model: 'opus', effort: 'high' } })
    })

    await waitFor(() => expect(result.current.model).toBe('opus'))
    expect(result.current.effort).toBe('high')
  })

  it('carries the rung by name across a model switch', async () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )
    await waitFor(() => expect(result.current.capabilities).not.toBeNull())
    act(() => result.current.setEffort('high'))

    act(() => result.current.setModel('sonnet'))

    expect(result.current.model).toBe('sonnet')
    expect(result.current.effort).toBe('high')
  })

  it('ignores a model change made before capabilities landed', () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )

    act(() => result.current.setModel('opus'))

    expect(result.current.model).toBe('opus')
    expect(result.current.effort).toBeNull()
  })

  it('re-detects on demand, keeping what survived the re-read', async () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli', workspace: '/ws' })
    )
    await waitFor(() => expect(result.current.capabilities).not.toBeNull())
    act(() => result.current.setModel('opus'))

    act(() => result.current.refresh())

    expect(result.current.refreshing).toBe(true)
    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(bridge.capabilities).toHaveBeenCalledWith('claude-cli', {
      workspace: '/ws',
      refresh: true
    })
    expect(result.current.model).toBe('opus')
  })

  it('carries agent, model and effort into a launch — and omits what was never chosen', async () => {
    const { result } = renderHook(() =>
      useRunConfig({ agents: AGENTS, defaultAgent: 'claude-cli' })
    )
    await waitFor(() => expect(result.current.capabilities).not.toBeNull())

    act(() => result.current.setModel('opus'))
    expect(result.current.launchOpts).toEqual({
      agentId: 'claude-cli',
      model: 'opus',
      effort: ''
    })
  })

  it('offers no pin, and no launch agent, when there is no agent at all', async () => {
    bridge.capabilities.mockResolvedValue(RUN_CONFIG_CAPABILITIES)
    const { result } = renderHook(() => useRunConfig({ agents: [], defaultAgent: null }))

    await waitFor(() => expect(result.current.capabilities).not.toBeNull())
    expect(result.current.pin).toBeUndefined()
    expect(result.current.launchOpts.agentId).toBeUndefined()
  })
})
