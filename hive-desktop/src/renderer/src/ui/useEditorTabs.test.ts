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
