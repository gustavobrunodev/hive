// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { isSpecOriginChange, useSpecOrigin } from './specOrigin'

/**
 * design-studio FIX-1 — spec.md Edge Cases:
 *
 *   "WHEN o arquivo da Spec muda em disco com a aba aberta THEN o Studio SHALL
 *    manter a sessão atual (a Spec é somente leitura e já foi consumida) e
 *    sinalizar que a origem mudou."
 *
 * Two claims, and the second one is the one that did not exist. The tests below
 * assert both halves, and the "keeps the session" half is asserted as a set of
 * negatives — the watcher must reach nothing the document owns.
 */

type Listener = (event: { type: 'add' | 'change' | 'unlink'; path: string }) => void

const SPEC = 'docs/ux/EXPERIENCE.md'

/**
 * `watchWorkspaceShared` multiplexes by root in module-level state that
 * outlives a test, so every test gets its own root. Sharing one would mean the
 * second test reusing the first test's group and never reaching its stub.
 */
let WORKSPACE: string
let roots = 0

let listeners: { root: string; onChange: Listener }[]
let stopped: number

beforeEach(() => {
  WORKSPACE = `/ws/${(roots += 1)}`
  listeners = []
  stopped = 0
  ;(globalThis as unknown as { window: Window }).window.hive = {
    watchWorkspace: (root: string, onChange: Listener) => {
      listeners.push({ root, onChange })
      return () => {
        stopped += 1
      }
    }
  } as unknown as Window['hive']
})

afterEach(() => {
  vi.restoreAllMocks()
})

function emit(event: { type: 'add' | 'change' | 'unlink'; path: string }): void {
  act(() => {
    for (const listener of [...listeners]) listener.onChange(event)
  })
}

describe('isSpecOriginChange — which change is *this* tab’s origin', () => {
  it('matches the Spec this tab was opened against', () => {
    expect(isSpecOriginChange({ type: 'change', path: SPEC }, SPEC)).toBe(true)
  })

  it('ignores every other file in the workspace', () => {
    expect(isSpecOriginChange({ type: 'change', path: 'docs/ux/OTHER.md' }, SPEC)).toBe(false)
    expect(isSpecOriginChange({ type: 'add', path: 'src/main/index.ts' }, SPEC)).toBe(false)
  })

  /**
   * An editor that writes through a temp file and renames over the original
   * surfaces as unlink + add rather than change. Treating only `change` as
   * drift would miss the most common way a file is actually saved.
   */
  it('counts a delete and a rewrite, not only an in-place change', () => {
    expect(isSpecOriginChange({ type: 'unlink', path: SPEC }, SPEC)).toBe(true)
    expect(isSpecOriginChange({ type: 'add', path: SPEC }, SPEC)).toBe(true)
  })
})

describe('useSpecOrigin — signalling that the origin moved', () => {
  it('starts quiet: an untouched Spec reports no drift', () => {
    const { result } = renderHook(() => useSpecOrigin(WORKSPACE, SPEC))
    expect(result.current.changed).toBe(false)
  })

  it('signals once the Spec changes on disk', () => {
    const { result } = renderHook(() => useSpecOrigin(WORKSPACE, SPEC))

    emit({ type: 'change', path: SPEC })

    expect(result.current.changed).toBe(true)
  })

  it('stays quiet when some other file in the workspace changes', () => {
    const { result } = renderHook(() => useSpecOrigin(WORKSPACE, SPEC))

    emit({ type: 'change', path: 'docs/ux/ANOTHER.md' })

    expect(result.current.changed).toBe(false)
  })

  it('lets the user acknowledge the drift, and signals again if it drifts again', () => {
    const { result } = renderHook(() => useSpecOrigin(WORKSPACE, SPEC))

    emit({ type: 'change', path: SPEC })
    act(() => result.current.dismiss())
    expect(result.current.changed).toBe(false)

    emit({ type: 'change', path: SPEC })
    expect(result.current.changed).toBe(true)
  })

  /**
   * The leak this guards against is a closed tab still holding a listener: the
   * Studio tab is opened and closed repeatedly over a session.
   */
  it('unsubscribes when the tab closes', () => {
    const { unmount } = renderHook(() => useSpecOrigin(WORKSPACE, SPEC))
    expect(stopped).toBe(0)

    unmount()

    expect(stopped).toBe(1)
  })

  it('follows the tab to a different Spec, dropping the previous drift', () => {
    const { result, rerender } = renderHook(({ path }) => useSpecOrigin(WORKSPACE, path), {
      initialProps: { path: SPEC }
    })
    emit({ type: 'change', path: SPEC })
    expect(result.current.changed).toBe(true)

    rerender({ path: 'docs/ux/OTHER.md' })

    expect(result.current.changed).toBe(false)
    expect(stopped).toBe(1)
  })

  it('watches nothing at all without a workspace or a Spec', () => {
    renderHook(() => useSpecOrigin('', ''))
    expect(listeners).toHaveLength(0)
  })
})
