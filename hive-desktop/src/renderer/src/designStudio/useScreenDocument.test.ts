// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { documentKey, useScreenDocument } from './useScreenDocument'
import type { ScreenDocument } from './documentModel'

/**
 * design-studio T5.1. The tab's mirror of the document main owns.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CATALOG = { dsId: 'ds', version: '1', components: [] }

const LOGIN: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: { id: 'n1', tag: 'wa-card', props: {}, children: [] }
}

function mockDocument(overrides: Record<string, unknown> = {}): {
  view: ReturnType<typeof vi.fn>
  dispatch: ReturnType<typeof vi.fn>
  undo: ReturnType<typeof vi.fn>
  redo: ReturnType<typeof vi.fn>
} {
  const api = {
    catalog: vi.fn().mockResolvedValue(CATALOG),
    view: vi.fn().mockResolvedValue({
      document: { screenId: 'login', title: 'Login', root: null },
      canUndo: false,
      canRedo: false
    }),
    dispatch: vi.fn().mockResolvedValue({ document: LOGIN, canUndo: true, canRedo: false }),
    undo: vi.fn().mockResolvedValue({
      document: { screenId: 'login', title: 'Login', root: null },
      canUndo: false,
      canRedo: true
    }),
    redo: vi.fn().mockResolvedValue({ document: LOGIN, canUndo: true, canRedo: false }),
    ...overrides
  }
  window.hive = { ...window.hive, designStudio: api } as unknown as typeof window.hive
  return api as unknown as ReturnType<typeof mockDocument>
}

describe('useScreenDocument — the document comes from main, never from here', () => {
  it('asks for the active Tela under a key that names workspace, Spec and Tela', async () => {
    const api = mockDocument()
    renderHook(() => useScreenDocument('/ws', 'docs/ux.md', 'login', 'Login'))

    await waitFor(() =>
      expect(api.view).toHaveBeenCalledWith(
        documentKey('/ws', 'docs/ux.md', 'login'),
        'login',
        'Login'
      )
    )
  })

  it('gives every Tela its own key, so two Telas never share a log', () => {
    expect(documentKey('/ws', 'a.md', 'login')).not.toBe(documentKey('/ws', 'a.md', 'cadastro'))
    expect(documentKey('/ws', 'a.md', 'login')).not.toBe(documentKey('/ws', 'b.md', 'login'))
  })

  it('holds an empty Tela while no Screen is active, and asks for nothing', async () => {
    const api = mockDocument()
    const { result } = renderHook(() => useScreenDocument('/ws', 'docs/ux.md', null, ''))

    expect(result.current.document.root).toBeNull()
    expect(api.view).not.toHaveBeenCalled()
  })

  it('reads the catalog once, and hands it on for the surfaces derived from it', async () => {
    const api = mockDocument()
    const { result, rerender } = renderHook(() =>
      useScreenDocument('/ws', 'docs/ux.md', 'login', 'Login')
    )

    await waitFor(() => expect(result.current.catalog).toEqual(CATALOG))
    rerender()
    expect((api as unknown as { catalog: ReturnType<typeof vi.fn> }).catalog).toHaveBeenCalledTimes(
      1
    )
  })
})

describe('useScreenDocument — an edit is a Command out and a whole view back', () => {
  it('adopts the view main returns and reports the new history state', async () => {
    mockDocument()
    const { result } = renderHook(() => useScreenDocument('/ws', 'docs/ux.md', 'login', 'Login'))
    await waitFor(() => expect(result.current.document.screenId).toBe('login'))

    let violation: unknown
    await act(async () => {
      violation = await result.current.dispatch(
        [{ type: 'AddComponent', parentId: null, index: 0, node: LOGIN.root! }],
        'g1'
      )
    })

    expect(violation).toBeNull()
    expect(result.current.document.root?.id).toBe('n1')
    expect(result.current.canUndo).toBe(true)
  })

  it('leaves the document exactly as it was when the edit is refused (DS-R6 AC-4)', async () => {
    mockDocument({
      dispatch: vi.fn().mockResolvedValue({
        kind: 'capability',
        componentId: 'n1',
        reason: 'não existe',
        attemptedValue: 'roxo'
      })
    })
    const { result } = renderHook(() => useScreenDocument('/ws', 'docs/ux.md', 'login', 'Login'))
    await waitFor(() => expect(result.current.document.screenId).toBe('login'))
    const before = result.current.document

    let violation: { kind?: string; attemptedValue?: unknown } | null = null
    await act(async () => {
      violation = await result.current.dispatch(
        [{ type: 'SetProp', componentId: 'n1', key: 'variant', value: 'roxo' }],
        'g1'
      )
    })

    expect(violation!.kind).toBe('capability')
    expect(violation!.attemptedValue).toBe('roxo')
    expect(result.current.document).toBe(before)
    expect(result.current.canUndo).toBe(false)
  })

  it('walks the log through main rather than moving a cursor of its own', async () => {
    const api = mockDocument()
    const { result } = renderHook(() => useScreenDocument('/ws', 'docs/ux.md', 'login', 'Login'))
    await waitFor(() => expect(result.current.document.screenId).toBe('login'))

    await act(async () => {
      result.current.undo()
    })
    expect(api.undo).toHaveBeenCalledWith(
      documentKey('/ws', 'docs/ux.md', 'login'),
      'login',
      'Login'
    )
    expect(result.current.canRedo).toBe(true)

    await act(async () => {
      result.current.redo()
    })
    expect(result.current.document.root?.id).toBe('n1')
  })

  it('dispatches nothing while no Tela is active', async () => {
    const api = mockDocument()
    const { result } = renderHook(() => useScreenDocument('/ws', 'docs/ux.md', null, ''))

    await act(async () => {
      await result.current.dispatch([{ type: 'RemoveComponent', componentId: 'n1' }], 'g1')
    })
    expect(api.dispatch).not.toHaveBeenCalled()
  })
})
