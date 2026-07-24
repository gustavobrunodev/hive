// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HistoryPanel } from './HistoryPanel'
import { GitProvider } from './useGit'
import { createGitStore } from '../testSupport/gitStoreMock'
import type { GitCommit } from './gitStatus'

function commit(n: number): GitCommit {
  return {
    hash: `hash${n}`,
    shortHash: `h${n}`,
    author: 'Tester',
    date: new Date(Date.now() - n * 3_600_000).toISOString(),
    subject: `commit ${n}`
  }
}

let logMock: ReturnType<typeof vi.fn>

function renderHistory(props: Partial<Parameters<typeof HistoryPanel>[0]> = {}): {
  onOpenCommit: ReturnType<typeof vi.fn>
} {
  const onOpenCommit = vi.fn()
  render(
    createElement(
      GitProvider,
      { store: createGitStore() },
      createElement(HistoryPanel, { onOpenCommit, ...props })
    )
  )
  return { onOpenCommit }
}

beforeEach(() => {
  logMock = vi.fn().mockResolvedValue([commit(1), commit(2), commit(3)])
  window.hive = { git: { log: logMock } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('HistoryPanel', () => {
  it('lists commits newest-first and opens a commit diff on click', async () => {
    const { onOpenCommit } = renderHistory()
    expect(await screen.findByText('commit 1')).toBeTruthy()
    expect(logMock).toHaveBeenCalledWith('/ws', { skip: 0, limit: 30, file: undefined })
    fireEvent.click(screen.getByText('commit 1'))
    expect(onOpenCommit).toHaveBeenCalledWith('hash1', 'commit 1')
  })

  it('pages with load-more and hides it once a short page returns', async () => {
    const full = Array.from({ length: 30 }, (_, i) => commit(i + 1))
    logMock.mockResolvedValueOnce(full).mockResolvedValueOnce([commit(31)])
    renderHistory()
    const more = await screen.findByText('Carregar mais')
    fireEvent.click(more)
    await waitFor(() =>
      expect(logMock).toHaveBeenCalledWith('/ws', { skip: 30, limit: 30, file: undefined })
    )
    await waitFor(() => expect(screen.queryByText('Carregar mais')).toBeNull())
  })

  it('scopes to a single file and clears the scope', async () => {
    const onClearScope = vi.fn()
    renderHistory({ file: 'src/a.txt', onClearScope })
    await waitFor(() =>
      expect(logMock).toHaveBeenCalledWith('/ws', { skip: 0, limit: 30, file: 'src/a.txt' })
    )
    expect(screen.getByText('Histórico de a.txt')).toBeTruthy()
    fireEvent.click(screen.getByText('Ver todo o histórico'))
    expect(onClearScope).toHaveBeenCalled()
  })

  it('shows an empty state when there are no commits', async () => {
    logMock.mockResolvedValue([])
    renderHistory()
    expect(await screen.findByText('Nenhum commit ainda.')).toBeTruthy()
  })

  it('degrades to empty on a log error', async () => {
    logMock.mockRejectedValue(new Error('boom'))
    renderHistory()
    expect(await screen.findByText('Nenhum commit ainda.')).toBeTruthy()
  })
})
