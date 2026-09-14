// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useEditorTabs } from './useEditorTabs'

/** The workspace watcher's listeners, so a test can make a file disappear. */
let watchers: ((event: { type: string; path: string }) => void)[] = []

beforeEach(() => {
  watchers = []
  window.hive = {
    ...window.hive,
    watchWorkspace: vi.fn((_root: string, onChange: (event: never) => void) => {
      watchers.push(onChange as never)
      return () => {}
    })
  } as unknown as typeof window.hive
})

afterEach(() => {
  // `watchWorkspaceShared` keeps ONE bridge subscription per root at module
  // scope: leaving a hook mounted means the next test's mock is never called.
  cleanup()
  vi.restoreAllMocks()
})

/** Reports `path` as gone, the way the workspace watcher would. */
function unlink(path: string): void {
  act(() => {
    for (const watcher of watchers) watcher({ type: 'unlink', path })
  })
}

describe('useEditorTabs — diff tabs (git-management §6.5)', () => {
  it('opens a diff tab with a synthetic key, kind and git descriptor', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openDiff('src/a.txt', 'working'))

    const tab = result.current.tabs[0]
    expect(tab.kind).toBe('diff')
    expect(tab.git).toEqual({ path: 'src/a.txt', side: 'working' })
    expect(tab.label).toBe('a.txt')
    expect(tab.path).toContain('src/a.txt')
    expect(result.current.activePath).toBe(tab.path)
  })

  it('opens a commit diff tab (GIT-R8.2) with the hash descriptor', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openCommitDiff('abc1234', 'fix: a thing'))

    const tab = result.current.tabs[0]
    expect(tab.kind).toBe('commit')
    expect(tab.git).toEqual({ hash: 'abc1234' })
    expect(tab.label).toBe('fix: a thing')
    expect(tab.path).toContain('abc1234')
    expect(result.current.activePath).toBe(tab.path)
  })

  it('opens a conflict view tab (GIT-R9) with the file descriptor', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openConflict('src/c.txt'))

    const tab = result.current.tabs[0]
    expect(tab.kind).toBe('conflict')
    expect(tab.git).toEqual({ path: 'src/c.txt' })
    expect(tab.label).toBe('c.txt')
    expect(tab.path).toContain('src/c.txt')
  })

  it('opens an agent-review diff tab with a synthetic key, kind and file descriptor', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openReviewDiff('src/r.txt'))

    const tab = result.current.tabs[0]
    expect(tab.kind).toBe('review')
    expect(tab.git).toEqual({ path: 'src/r.txt' })
    expect(tab.label).toBe('r.txt')
    // Distinct synthetic key so the file tab and its review diff can coexist.
    expect(tab.path).toContain('src/r.txt')
    expect(tab.path).not.toBe('src/r.txt')
  })

  it('keeps a diff tab and its file tab open at once (distinct keys)', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openFile('a.txt', { pin: true }))
    act(() => result.current.openDiff('a.txt', 'staged'))
    expect(result.current.tabs).toHaveLength(2)
    expect(result.current.tabs.map((t) => t.kind).sort()).toEqual(['diff', 'file'])
  })

  it('reuses the preview slot for successive diff opens', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openDiff('a.txt', 'working'))
    act(() => result.current.openDiff('b.txt', 'working'))
    // Both are unpinned previews → the second replaces the first.
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.tabs[0].git?.path).toBe('b.txt')
  })

  it('focuses an already-open diff tab rather than duplicating it', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openFile('keep.txt', { pin: true }))
    act(() => result.current.openDiff('a.txt', 'working'))
    act(() => result.current.pinTab(result.current.tabs[1].path))
    act(() => result.current.openDiff('a.txt', 'working'))
    expect(result.current.tabs.filter((t) => t.kind === 'diff')).toHaveLength(1)
  })
})

/**
 * The tab menu's close family (VS Code parity). What matters here is not that
 * a set of tabs disappears but *which* tabs and *which one is left showing* —
 * a bulk close that leaves the strip focused on nothing, or that swallows an
 * edited file without asking, is worse than no menu at all.
 */
describe('useEditorTabs — the close family', () => {
  /** Opens three pinned tabs, active on the middle one. */
  function threeOpen(): ReturnType<typeof renderHook<ReturnType<typeof useEditorTabs>, unknown>> {
    const rendered = renderHook(() => useEditorTabs())
    act(() => {
      rendered.result.current.openFile('a.txt', { pin: true })
      rendered.result.current.openFile('b.txt', { pin: true })
      rendered.result.current.openFile('c.txt', { pin: true })
      rendered.result.current.selectTab('b.txt')
    })
    return rendered
  }

  const paths = (result: { current: ReturnType<typeof useEditorTabs> }): string[] =>
    result.current.tabs.map((tab) => tab.path)

  it('closes every tab but the one asked about, and activates it', () => {
    const { result } = threeOpen()
    act(() => result.current.closeOtherTabs('c.txt'))

    expect(paths(result)).toEqual(['c.txt'])
    expect(result.current.activePath).toBe('c.txt')
  })

  it('closes only what is to the right', () => {
    const { result } = threeOpen()
    act(() => result.current.closeTabsToTheRight('a.txt'))

    expect(paths(result)).toEqual(['a.txt'])
    expect(result.current.activePath).toBe('a.txt')
  })

  it('closes all of them and leaves nothing active', () => {
    const { result } = threeOpen()
    act(() => result.current.closeAllTabs())

    expect(paths(result)).toEqual([])
    expect(result.current.activePath).toBeNull()
  })

  it('closes the saved ones and keeps the edited one, without asking', () => {
    const { result } = threeOpen()
    act(() => result.current.handleDirtyChange('b.txt', true))
    act(() => result.current.closeSavedTabs())

    expect(paths(result)).toEqual(['b.txt'])
    expect(result.current.pendingClose).toBeNull()
  })

  it('asks once per edited file, and clean tabs go without a question', () => {
    const { result } = threeOpen()
    act(() => {
      result.current.handleDirtyChange('a.txt', true)
      result.current.handleDirtyChange('c.txt', true)
    })

    act(() => result.current.closeAllTabs())

    // The clean one is already gone; the two edited ones are queued.
    expect(paths(result)).toEqual(['a.txt', 'c.txt'])
    expect(result.current.pendingClose).toBe('a.txt')
    expect(result.current.pendingCloseRemaining).toBe(1)

    act(() => result.current.discardPendingClose())
    expect(result.current.pendingClose).toBe('c.txt')
    expect(result.current.pendingCloseRemaining).toBe(0)

    act(() => result.current.discardPendingClose())
    expect(paths(result)).toEqual([])
    expect(result.current.pendingClose).toBeNull()
  })

  it('Cancelar abandons the whole run, not just the file it is asking about', () => {
    const { result } = threeOpen()
    act(() => {
      result.current.handleDirtyChange('a.txt', true)
      result.current.handleDirtyChange('c.txt', true)
    })
    act(() => result.current.closeAllTabs())
    act(() => result.current.cancelPendingClose())

    expect(result.current.pendingClose).toBeNull()
    expect(paths(result)).toEqual(['a.txt', 'c.txt'])
  })

  it('activating the closed tab falls to its right neighbour, then to the last', () => {
    const { result } = threeOpen()
    act(() => result.current.removeTab('b.txt'))
    expect(result.current.activePath).toBe('c.txt')

    act(() => result.current.removeTab('c.txt'))
    expect(result.current.activePath).toBe('a.txt')
  })

  it('"Fechar as da direita" on the last tab is a no-op, not a close', () => {
    const { result } = threeOpen()
    act(() => result.current.closeTabsToTheRight('c.txt'))
    expect(paths(result)).toEqual(['a.txt', 'b.txt', 'c.txt'])
  })
})

/**
 * workspace-session — putting a previously-open strip back. File tabs only,
 * and never over a strip the user has already put something in.
 */
describe('useEditorTabs — restoreTabs (workspace-session)', () => {
  it('restores the strip in order, keeping each tab pinned as it was', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() =>
      result.current.restoreTabs(
        [
          { path: 'docs/prd.md', pinned: true },
          { path: 'README.md', pinned: false }
        ],
        'README.md'
      )
    )

    expect(result.current.tabs.map((tab) => tab.path)).toEqual(['docs/prd.md', 'README.md'])
    expect(result.current.tabs.map((tab) => tab.pinned)).toEqual([true, false])
    expect(result.current.tabs.every((tab) => tab.kind === 'file')).toBe(true)
    expect(result.current.activePath).toBe('README.md')
  })

  it('falls back to the first tab when the remembered active one did not survive', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.restoreTabs([{ path: 'README.md', pinned: false }], 'docs/gone.md'))
    expect(result.current.activePath).toBe('README.md')
  })

  it('does nothing with an empty restore', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.restoreTabs([], null))
    expect(result.current.tabs).toEqual([])
    expect(result.current.activePath).toBeNull()
  })

  // The restore needs a round trip to disk to drop tabs whose files are gone,
  // and someone who clicked a tree row inside that window has already said
  // what they want on screen.
  it('yields to a user who opened something first', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openFile('notes.md'))
    act(() => result.current.restoreTabs([{ path: 'docs/prd.md', pinned: true }], 'docs/prd.md'))

    expect(result.current.tabs.map((tab) => tab.path)).toEqual(['notes.md'])
    expect(result.current.activePath).toBe('notes.md')
  })
})

/**
 * A file that no longer exists closes its own tab.
 *
 * Reported by the workspace watcher, not by the delete button, because the
 * button is not the only way a file goes away: the same tab has to close when
 * the file is deleted from the Arquivos tree, from the "Contexto" section of an
 * open initiative, by the agent, or by a `git checkout`.
 */
describe('useEditorTabs — a deleted file closes its editor', () => {
  it('closes the tab of a file that was deleted', () => {
    const { result } = renderHook(() => useEditorTabs('/ws'))
    act(() => result.current.openFile('docs/prd.md', { pin: true }))
    act(() => result.current.openFile('README.md', { pin: true }))

    unlink('docs/prd.md')
    expect(result.current.tabs.map((tab) => tab.path)).toEqual(['README.md'])
  })

  it('closes it even with unsaved changes, because there is nothing left to save it to', () => {
    const { result } = renderHook(() => useEditorTabs('/ws'))
    act(() => result.current.openFile('docs/prd.md', { pin: true }))
    act(() => result.current.handleDirtyChange('docs/prd.md', true))

    unlink('docs/prd.md')
    // No guard dialog: its whole offer is "save it first", and the file is
    // gone. A surviving tab's next save would recreate what was just deleted.
    expect(result.current.tabs).toEqual([])
    expect(result.current.pendingClose).toBeNull()
    expect(result.current.dirtyPaths.has('docs/prd.md')).toBe(false)
  })

  it('takes the tabs of everything under a deleted folder', () => {
    const { result } = renderHook(() => useEditorTabs('/ws'))
    act(() => result.current.openFile('docs/iniciativas/R1/testes/prd.md', { pin: true }))
    act(() => result.current.openFile('docs/iniciativas/R1/testes/ux.md', { pin: true }))
    act(() => result.current.openFile('README.md', { pin: true }))

    // Some platforms report the directory and never its children.
    unlink('docs/iniciativas/R1/testes')
    expect(result.current.tabs.map((tab) => tab.path)).toEqual(['README.md'])
  })

  it('does not mistake a sibling whose name merely starts the same', () => {
    const { result } = renderHook(() => useEditorTabs('/ws'))
    act(() => result.current.openFile('docs/prd.md', { pin: true }))
    act(() => result.current.openFile('docs/prd.md.bak', { pin: true }))

    unlink('docs/prd.md')
    expect(result.current.tabs.map((tab) => tab.path)).toEqual(['docs/prd.md.bak'])
  })

  it('leaves the strip alone for an add or a change', () => {
    const { result } = renderHook(() => useEditorTabs('/ws'))
    act(() => result.current.openFile('docs/prd.md', { pin: true }))
    act(() => {
      for (const watcher of watchers) watcher({ type: 'change', path: 'docs/prd.md' })
    })
    expect(result.current.tabs).toHaveLength(1)
  })

  it('watches nothing without a workspace', () => {
    renderHook(() => useEditorTabs())
    expect(window.hive.watchWorkspace).not.toHaveBeenCalled()
  })
})
