// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useEditorTabs } from './useEditorTabs'

afterEach(() => {
  cleanup()
})

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

describe('useEditorTabs — Design Studio tabs (design-studio DS-R1)', () => {
  it('opens a Design Studio tab with a synthetic key, kind and spec descriptor', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openDesignStudio('docs/ux/EXPERIENCE.md'))

    const tab = result.current.tabs[0]
    expect(tab.kind).toBe('design-studio')
    expect(tab.spec).toEqual({ path: 'docs/ux/EXPERIENCE.md' })
    expect(tab.label).toBe('EXPERIENCE.md')
    expect(result.current.activePath).toBe(tab.path)
  })

  it('never collides with the plain file tab for the same Spec path', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openFile('spec.md', { pin: true }))
    act(() => result.current.openDesignStudio('spec.md'))

    expect(result.current.tabs).toHaveLength(2)
    const studio = result.current.tabs.find((tab) => tab.kind === 'design-studio')
    expect(studio?.path).not.toBe('spec.md')
    expect(result.current.tabs.filter((tab) => tab.kind === 'file')[0].path).toBe('spec.md')
  })

  it('focuses the existing tab when the same Spec is opened twice (AC-4)', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openDesignStudio('spec.md'))
    const first = result.current.tabs[0].path
    act(() => result.current.openFile('other.txt'))
    act(() => result.current.openDesignStudio('spec.md'))

    expect(result.current.tabs.filter((tab) => tab.kind === 'design-studio')).toHaveLength(1)
    expect(result.current.activePath).toBe(first)
  })

  it('opens pinned, so the next single-click open cannot discard the session', () => {
    const { result } = renderHook(() => useEditorTabs())
    act(() => result.current.openDesignStudio('spec.md'))
    act(() => result.current.openFile('other.txt'))

    expect(result.current.tabs).toHaveLength(2)
    expect(result.current.tabs[0].pinned).toBe(true)
  })
})
