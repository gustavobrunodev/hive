// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useMountedLayers } from './useMountedLayers'

afterEach(() => cleanup())

/**
 * The rule both layer stacks depend on: a surface is created the first time it
 * is asked for and kept forever after. Unmounting is what used to close every
 * folder in the Explorer, and it would drop a turn still streaming into `Chat`.
 */
describe('useMountedLayers', () => {
  it('mounts lazily, then keeps every layer it has shown', () => {
    const { result, rerender } = renderHook(({ active }) => useMountedLayers(active), {
      initialProps: { active: 'explorer' }
    })
    expect(result.current).toEqual(['explorer'])

    rerender({ active: 'scm' })
    expect(result.current).toEqual(['explorer', 'scm'])

    // Going back adds nothing: the layer is already there, holding its state.
    rerender({ active: 'explorer' })
    expect(result.current).toEqual(['explorer', 'scm'])
  })

  it('honours layers that must exist from the first frame', () => {
    const { result } = renderHook(() => useMountedLayers('brain', ['chat']))
    // `chat` holds the live session, so the work pane mounts it whether or not
    // a tool is covering it — and the restored tool comes along on frame one.
    expect(result.current).toEqual(['chat', 'brain'])
  })

  it('does not duplicate an initial layer that is also the active one', () => {
    const { result } = renderHook(() => useMountedLayers('chat', ['chat']))
    expect(result.current).toEqual(['chat'])
  })

  it('keeps a stable array while nothing new is shown, so consumers do not re-render', () => {
    const { result, rerender } = renderHook(({ active }) => useMountedLayers(active, ['chat']), {
      initialProps: { active: 'chat' as string }
    })
    const first = result.current
    rerender({ active: 'chat' })
    expect(result.current).toBe(first)

    act(() => undefined)
    rerender({ active: 'review' })
    expect(result.current).not.toBe(first)
    expect(result.current).toEqual(['chat', 'review'])
  })
})
