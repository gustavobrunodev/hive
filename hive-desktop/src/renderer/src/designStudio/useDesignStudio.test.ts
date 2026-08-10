// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useDesignStudio } from './useDesignStudio'
import type { ScreensResponse } from './screens'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockScreens(impl: () => Promise<ScreensResponse>): ReturnType<typeof vi.fn> {
  const screens = vi.fn(impl)
  window.hive = { ...window.hive, designStudio: { screens } } as unknown as typeof window.hive
  return screens
}

const threeScreens: ScreensResponse = {
  screens: [
    { screenId: 'login', title: 'Login', probe: 'screenHeading' },
    { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' },
    { screenId: 'sucesso', title: 'Sucesso', probe: 'screenHeading' }
  ],
  probed: ['screenHeading', 'iaTable']
}

describe('useDesignStudio (T4.3, DS-R1)', () => {
  it('starts loading, then lists every Tela with the first one active', async () => {
    const screens = mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(screens).toHaveBeenCalledWith('/ws', 'docs/ux.md')
    expect(result.current.screens).toHaveLength(3)
    expect(result.current.activeScreenId).toBe('login')
  })

  it('switches the active Tela on demand', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.selectScreen('sucesso'))
    expect(result.current.activeScreenId).toBe('sucesso')
  })

  it('a Spec with no Tela is empty, not an error, and keeps what was probed', async () => {
    mockScreens(async () => ({ screens: [], probed: ['screenHeading', 'iaTable'] }))
    const { result } = renderHook(() => useDesignStudio('/ws', 'notas.md'))

    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.error).toBeNull()
    expect(result.current.probed).toEqual(['screenHeading', 'iaTable'])
    expect(result.current.activeScreenId).toBeNull()
  })

  it('surfaces an OperationError from the bridge and clears it on a successful reload', async () => {
    let response: ScreensResponse = {
      kind: 'operation',
      scope: 'io',
      message: 'ENOENT',
      retryable: true
    }
    const screens = mockScreens(async () => response)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.message).toBe('ENOENT')

    response = threeScreens
    act(() => result.current.reload())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.error).toBeNull()
    expect(screens).toHaveBeenCalledTimes(2)
  })

  it('turns a broken channel into the same OperationError shape, never a third shape', async () => {
    mockScreens(async () => {
      throw new Error('bridge morto')
    })
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toEqual({
      kind: 'operation',
      scope: 'io',
      message: 'bridge morto',
      retryable: true
    })
  })

  it('reports a non-Error rejection with its own text', async () => {
    mockScreens(async () => {
      throw 'sem permissão'
    })
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    await waitFor(() => expect(result.current.error?.message).toBe('sem permissão'))
  })

  it('re-reads when the Spec path changes', async () => {
    const screens = mockScreens(async () => threeScreens)
    const { rerender } = renderHook(({ path }) => useDesignStudio('/ws', path), {
      initialProps: { path: 'a.md' }
    })
    await waitFor(() => expect(screens).toHaveBeenCalledWith('/ws', 'a.md'))

    rerender({ path: 'b.md' })
    await waitFor(() => expect(screens).toHaveBeenCalledWith('/ws', 'b.md'))
  })

  it('drops a read that settles after unmount instead of setting state on a dead hook', async () => {
    let settle: (value: ScreensResponse) => void = () => {}
    mockScreens(
      () =>
        new Promise<ScreensResponse>((resolve) => {
          settle = resolve
        })
    )
    const { unmount } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    unmount()
    settle(threeScreens)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('drives undo/redo availability off the active Tela’s own log (T4.4)', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.recordStep('g1'))
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.canRedo).toBe(false)
  })

  it('ignores a history action while no Tela is active', async () => {
    mockScreens(async () => ({ screens: [], probed: ['screenHeading', 'iaTable'] }))
    const { result } = renderHook(() => useDesignStudio('/ws', 'notas.md'))
    await waitFor(() => expect(result.current.status).toBe('empty'))

    act(() => result.current.recordStep('g1'))
    expect(result.current.sessions).toEqual({})
    expect(result.current.canUndo).toBe(false)
  })

  it('opens on Desktop and changes viewport without touching the undo log (DS-R3 AC-6)', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.recordStep('g1'))

    act(() => result.current.setViewport({ presetId: 'mobile', width: 390, height: 844 }))

    expect(result.current.viewport.presetId).toBe('mobile')
    // The edit is still exactly one undo step — the preset is not one.
    expect(result.current.session.steps).toEqual(['g1'])
    expect(result.current.canUndo).toBe(true)
  })

  /**
   * T4.7's whole point (DS-R4 AC-2): edit A, go to B, come back to A and
   * everything is as you left it — tree position in the log, transcript, and
   * where the undo cursor was parked. Leaving a Tela is navigation, not a
   * commit and not a reset.
   */
  it('returns to a Tela with its log, cursor and transcript exactly as left', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.recordStep('a1'))
    act(() => result.current.recordStep('a2'))
    act(() => result.current.undo())
    act(() => result.current.appendMessage({ id: 'm1', role: 'user', text: 'deixa mais calmo' }))

    const parkedOnA = { steps: ['a1', 'a2'], cursor: 1 }
    expect(result.current.session.steps).toEqual(parkedOnA.steps)

    act(() => result.current.selectScreen('cadastro'))
    expect(result.current.session.steps).toEqual([])
    expect(result.current.session.transcript).toEqual([])
    act(() => result.current.recordStep('b1'))

    act(() => result.current.selectScreen('login'))
    expect(result.current.session.steps).toEqual(parkedOnA.steps)
    expect(result.current.session.cursor).toBe(parkedOnA.cursor)
    expect(result.current.session.transcript).toEqual([
      { id: 'm1', role: 'user', text: 'deixa mais calmo' }
    ])
    // Redo is still available where it was parked, not reset by the round trip.
    expect(result.current.canRedo).toBe(true)
    expect(result.current.canUndo).toBe(true)

    // And B kept its own, untouched by A's return.
    expect(result.current.sessions.cadastro.steps).toEqual(['b1'])
  })

  it('marks only the Telas the user actually entered as edited', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.recordStep('a1'))

    expect(Object.keys(result.current.sessions)).toEqual(['login'])
  })

  /**
   * T5.1 / DS-R5 AC-6. Selecting is looking, and looking is not an edit. The
   * assertions that matter here are the two negatives: the log does not grow
   * and the per-Tela session is not written — a selection that produced either
   * would put "I clicked something" into the user's undo history and onto disk.
   */
  it('selects a Component without pushing a step onto the undo log', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.selectComponent('n4'))

    expect(result.current.selectedComponentId).toBe('n4')
    expect(result.current.session.steps).toEqual([])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('leaves the persisted session untouched when the selection changes', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.recordStep('a1'))

    const before = result.current.sessions

    act(() => result.current.selectComponent('n4'))
    act(() => result.current.selectComponent('n2'))
    act(() => result.current.selectComponent(null))

    // Same object, not merely an equal one: nothing rewrote the session.
    expect(result.current.sessions).toBe(before)
    expect(result.current.sessions.login.steps).toEqual(['a1'])
  })

  it('clears the selection when the Tela changes, because node ids are per-Tela', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.selectComponent('n4'))
    act(() => result.current.selectScreen('cadastro'))
    expect(result.current.selectedComponentId).toBeNull()

    // And it does not come back on return: the selection was never recorded.
    act(() => result.current.selectScreen('login'))
    expect(result.current.selectedComponentId).toBeNull()
  })

  it('drops the selection when asked to, without touching anything else', async () => {
    mockScreens(async () => threeScreens)
    const { result } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.selectComponent('n4'))
    act(() => result.current.selectComponent(null))
    expect(result.current.selectedComponentId).toBeNull()
  })

  it('drops a read that fails after unmount, for the same reason', async () => {
    let fail: (reason: Error) => void = () => {}
    mockScreens(
      () =>
        new Promise<ScreensResponse>((_resolve, reject) => {
          fail = reject
        })
    )
    const { unmount } = renderHook(() => useDesignStudio('/ws', 'docs/ux.md'))

    unmount()
    fail(new Error('tarde demais'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
