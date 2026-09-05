// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { initialEngine, pinFor, resetEnginePins, useEnginePins } from './enginePins'
import type { EngineCapabilities } from './engineOptions'
import { installRunConfigMock, RUN_CONFIG_CAPABILITIES } from '../testSupport/hiveRunConfigMock'

/**
 * engine-pins — the model an agent starts on, kept.
 *
 * Two things are worth proving here and nowhere else: the **order** a control
 * opens by (a session's own pick, then the pin, then the CLI's default), and
 * that the cache is genuinely shared — pinning on one surface has to be true
 * on the other three without either of them re-reading.
 */

const CLAUDE: EngineCapabilities = RUN_CONFIG_CAPABILITIES

afterEach(() => {
  // Unmount first: a hook still mounted when the bridge mock is restored keeps
  // calling a spy that no longer answers, which surfaces as an unhandled
  // rejection from an effect nobody is watching.
  cleanup()
  resetEnginePins()
  vi.restoreAllMocks()
})

describe('initialEngine', () => {
  it('lands on the CLI default row with nothing pinned and nothing remembered', () => {
    expect(initialEngine(CLAUDE, null)).toEqual({ model: '', effort: '' })
  })

  it('lands on the pin when there is one', () => {
    expect(initialEngine(CLAUDE, { model: 'opus', effort: 'high' })).toEqual({
      model: 'opus',
      effort: 'high'
    })
  })

  it("lets this session's own pick outrank the pin", () => {
    // The pin says where a *new* control opens; it must never yank a choice
    // out from under a surface that already has one.
    expect(
      initialEngine(CLAUDE, { model: 'opus', effort: 'high' }, { model: 'sonnet', effort: 'low' })
    ).toEqual({ model: 'sonnet', effort: 'low' })
  })

  it('falls through to the CLI default when the pinned model is gone', () => {
    // A provider switch or an account change can retire a model. Sending its
    // id anyway is a turn that fails on a flag the user never typed.
    expect(initialEngine(CLAUDE, { model: 'retired-model', effort: 'high' })).toEqual({
      model: '',
      effort: 'high'
    })
  })

  it('keeps a pinned effort with no pinned ladder entry off the value', () => {
    expect(initialEngine(CLAUDE, { model: 'opus', effort: 'nonexistent' })).toEqual({
      model: 'opus',
      effort: ''
    })
  })
})

describe('pinFor', () => {
  it('answers null for an agent with no id yet', () => {
    expect(pinFor({ 'claude-cli': { model: 'opus', effort: null } }, null)).toBeNull()
    expect(pinFor({ 'claude-cli': { model: 'opus', effort: null } }, '')).toBeNull()
  })
})

describe('useEnginePins', () => {
  let bridge: ReturnType<typeof installRunConfigMock>

  beforeEach(() => {
    bridge = installRunConfigMock({ pins: { 'claude-cli': { model: 'opus', effort: 'high' } } })
  })

  it('reads the persisted set once, however many surfaces are mounted', async () => {
    const first = renderHook(() => useEnginePins('claude-cli'))
    const second = renderHook(() => useEnginePins('copilot-cli'))

    await waitFor(() => expect(first.result.current.ready).toBe(true))
    expect(first.result.current.pin).toEqual({ model: 'opus', effort: 'high' })
    expect(second.result.current.pin).toBeNull()
    // One read for the window, not one per surface.
    expect(bridge.pins).toHaveBeenCalledTimes(1)
  })

  it('shows a pin made on one surface to every other one', async () => {
    const composer = renderHook(() => useEnginePins('copilot-cli'))
    const sheet = renderHook(() => useEnginePins('copilot-cli'))
    await waitFor(() => expect(composer.result.current.ready).toBe(true))

    act(() => sheet.result.current.setPin({ model: 'gpt-5', effort: null }))

    expect(composer.result.current.pin).toEqual({ model: 'gpt-5', effort: null })
    await waitFor(() =>
      expect(bridge.pin).toHaveBeenCalledWith('copilot-cli', { model: 'gpt-5', effort: null })
    )
  })

  it('unpins with null, and persists the removal', async () => {
    const { result } = renderHook(() => useEnginePins('claude-cli'))
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.setPin(null))

    expect(result.current.pin).toBeNull()
    await waitFor(() => expect(bridge.stored['claude-cli']).toBeUndefined())
  })

  it('re-reads the truth when a write is refused, rather than keeping a lie on screen', async () => {
    const { result } = renderHook(() => useEnginePins('claude-cli'))
    await waitFor(() => expect(result.current.ready).toBe(true))
    bridge.pin.mockRejectedValueOnce(new Error('disk full'))

    act(() => result.current.setPin({ model: 'sonnet', effort: 'low' }))

    // Optimistic first…
    expect(result.current.pin).toEqual({ model: 'sonnet', effort: 'low' })
    // …then back to what disk actually holds.
    await waitFor(() => expect(result.current.pin).toEqual({ model: 'opus', effort: 'high' }))
  })

  it('refuses to pin without an agent to pin to', async () => {
    const { result } = renderHook(() => useEnginePins(null))
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.setPin({ model: 'opus', effort: null }))

    expect(bridge.pin).not.toHaveBeenCalled()
  })

  it('reports ready with no pins when the bridge has no pin namespace at all', async () => {
    // The enhancement must never take the control down with it — a renderer
    // whose preload predates this feature still gets a working picker.
    resetEnginePins()
    window.hive = { ...window.hive, agent: {} } as unknown as typeof window.hive
    const { result } = renderHook(() => useEnginePins('claude-cli'))

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.pin).toBeNull()
    act(() => result.current.setPin({ model: 'opus', effort: null }))
    expect(result.current.pin).toBeNull()
  })

  it('reports ready with no pins when the read itself fails', async () => {
    resetEnginePins()
    bridge.pins.mockRejectedValueOnce(new Error('ipc down'))
    const { result } = renderHook(() => useEnginePins('claude-cli'))

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.pin).toBeNull()
  })
})
