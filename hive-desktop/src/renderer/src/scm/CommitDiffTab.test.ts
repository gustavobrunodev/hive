// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CommitDiffTab } from './CommitDiffTab'
import { GitProvider } from './useGit'
import { createGitStore } from '../testSupport/gitStoreMock'
import type { GitCommitDiff } from './gitStatus'

const commitDiff: GitCommitDiff = {
  files: [
    { path: 'src/a.txt', added: 3, deleted: 1, binary: false },
    // A text file with null counts exercises the `?? 0` fallback.
    { path: 'empty.txt', added: null, deleted: null, binary: false },
    { path: 'logo.png', added: null, deleted: null, binary: true }
  ],
  diff: {
    binary: false,
    hunks: [
      {
        header: '@@ -1,2 +1,3 @@',
        oldStart: 1,
        newStart: 1,
        lines: [{ type: 'add', oldNo: null, newNo: 1, text: 'hello' }]
      }
    ]
  }
}

let commitDiffMock: ReturnType<typeof vi.fn>

function renderTab(): void {
  render(
    createElement(
      GitProvider,
      { store: createGitStore() },
      createElement(CommitDiffTab, { hash: 'abc1234def' })
    )
  )
}

beforeEach(() => {
  commitDiffMock = vi.fn().mockResolvedValue(commitDiff)
  window.hive = { git: { commitDiff: commitDiffMock } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('CommitDiffTab', () => {
  it('loads the commit, lists changed files with stats, and renders the diff', async () => {
    renderTab()
    expect(await screen.findByText('a.txt')).toBeTruthy()
    expect(commitDiffMock).toHaveBeenCalledWith('/ws', 'abc1234def')
    expect(screen.getByText('3 arquivos alterados')).toBeTruthy()
    expect(screen.getByText('+3')).toBeTruthy()
    expect(screen.getByText('−1')).toBeTruthy()
    // Binary file shows no numeric stat.
    expect(screen.getByText('logo.png')).toBeTruthy()
    // The patch line renders in the DiffView.
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('degrades gracefully on a commitDiff error', async () => {
    commitDiffMock.mockRejectedValue(new Error('boom'))
    renderTab()
    await waitFor(() => expect(screen.getByText('0 arquivos alterados')).toBeTruthy())
  })
})
