// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { DiffTab } from './DiffTab'
import { GitProvider, type GitStore } from './useGit'
import type { GitDiff } from './gitStatus'
import { createGitStore } from '../testSupport/gitStoreMock'

function store(): GitStore {
  return createGitStore({ status: null })
}

const diff: GitDiff = {
  binary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      newStart: 1,
      lines: [{ type: 'add', oldNo: null, newNo: 1, text: 'hello' }]
    }
  ]
}

function renderTab(path = 'a.txt', side: 'working' | 'staged' = 'working'): void {
  render(createElement(GitProvider, { store: store() }, createElement(DiffTab, { path, side })))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DiffTab', () => {
  it('loads the diff for the working side and renders it with a titled header', async () => {
    const diffFn = vi.fn(async () => diff)
    window.hive = { git: { diff: diffFn } } as unknown as typeof window.hive
    renderTab('src/a.txt', 'working')

    await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
    expect(diffFn).toHaveBeenCalledWith('/ws', 'src/a.txt', 'working')
    expect(screen.getByText('a.txt (árvore de trabalho)')).toBeTruthy()
  })

  it('labels the staged side', async () => {
    window.hive = { git: { diff: vi.fn(async () => diff) } } as unknown as typeof window.hive
    renderTab('a.txt', 'staged')
    await waitFor(() => expect(screen.getByText('a.txt (preparado)')).toBeTruthy())
  })

  it('shows a loading skeleton until the diff resolves', async () => {
    let resolve: (d: GitDiff) => void = () => {}
    const pending = new Promise<GitDiff>((r) => {
      resolve = r
    })
    window.hive = { git: { diff: vi.fn(() => pending) } } as unknown as typeof window.hive
    const { container } = render(
      createElement(
        GitProvider,
        { store: store() },
        createElement(DiffTab, { path: 'a', side: 'working' })
      )
    )
    expect(container.querySelector('.wb-diff-loading')).not.toBeNull()
    resolve(diff)
    await waitFor(() => expect(container.querySelector('.wb-diff-loading')).toBeNull())
  })

  it('falls back to an empty diff when the load fails', async () => {
    window.hive = {
      git: { diff: vi.fn(async () => Promise.reject(new Error('boom'))) }
    } as unknown as typeof window.hive
    renderTab()
    await waitFor(() => expect(screen.getByText('Sem diferenças')).toBeTruthy())
  })
})
