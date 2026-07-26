// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WikiTree } from './WikiTree'

type Node = { name: string; path: string; type: 'file' | 'directory' }

function mockListTree(byPath: Record<string, Node[]>): ReturnType<typeof vi.fn> {
  const listTree = vi.fn(async (_ws: string, rel: string) => byPath[rel] ?? [])
  window.hive = { ...window.hive, listTree } as typeof window.hive
  return listTree
}

describe('WikiTree (T8)', () => {
  beforeEach(() => {
    window.hive = { ...window.hive } as typeof window.hive
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('lists the wiki root and opens a file in the editor on click', async () => {
    mockListTree({
      'second-brain/wiki': [
        { name: 'index.md', path: 'second-brain/wiki/index.md', type: 'file' },
        { name: 'concepts', path: 'second-brain/wiki/concepts', type: 'directory' }
      ]
    })
    const onOpenFile = vi.fn()
    render(
      createElement(WikiTree, {
        workspace: '/ws',
        rootRelPath: 'second-brain/wiki',
        onOpenFile
      })
    )

    await waitFor(() => expect(screen.getByText('index.md')).toBeTruthy())
    fireEvent.click(screen.getByText('index.md'))
    expect(onOpenFile).toHaveBeenCalledWith('second-brain/wiki/index.md')
  })

  it('expands a folder lazily, fetching its children only once', async () => {
    const listTree = mockListTree({
      'second-brain/wiki': [
        { name: 'concepts', path: 'second-brain/wiki/concepts', type: 'directory' }
      ],
      'second-brain/wiki/concepts': [
        { name: 'ddd.md', path: 'second-brain/wiki/concepts/ddd.md', type: 'file' }
      ]
    })
    render(
      createElement(WikiTree, {
        workspace: '/ws',
        rootRelPath: 'second-brain/wiki',
        onOpenFile: vi.fn()
      })
    )

    const folder = await screen.findByText('concepts')
    expect(screen.queryByText('ddd.md')).toBeNull()

    fireEvent.click(folder)
    await waitFor(() => expect(screen.getByText('ddd.md')).toBeTruthy())
    expect(listTree).toHaveBeenCalledWith('/ws', 'second-brain/wiki/concepts')

    // Collapse then re-expand: children are cached, not re-fetched.
    const callsAfterFirstExpand = listTree.mock.calls.length
    fireEvent.click(folder)
    await waitFor(() => expect(screen.queryByText('ddd.md')).toBeNull())
    fireEvent.click(folder)
    await waitFor(() => expect(screen.getByText('ddd.md')).toBeTruthy())
    expect(listTree.mock.calls.length).toBe(callsAfterFirstExpand)
  })

  it('shows the teaching empty state when the wiki has no pages', async () => {
    mockListTree({})
    render(
      createElement(WikiTree, {
        workspace: '/ws',
        rootRelPath: 'second-brain/wiki',
        onOpenFile: vi.fn()
      })
    )
    await waitFor(() =>
      expect(
        screen.getByText('O wiki ainda não tem páginas. Ingira algum conhecimento para começar.')
      ).toBeTruthy()
    )
  })

  it('treats a missing wiki dir (listTree rejects) as empty instead of crashing', async () => {
    const listTree = vi.fn().mockRejectedValue(new Error('ENOENT'))
    window.hive = { ...window.hive, listTree } as typeof window.hive
    render(
      createElement(WikiTree, {
        workspace: '/ws',
        rootRelPath: 'second-brain/wiki',
        onOpenFile: vi.fn()
      })
    )
    await waitFor(() =>
      expect(
        screen.getByText('O wiki ainda não tem páginas. Ingira algum conhecimento para começar.')
      ).toBeTruthy()
    )
  })
})
