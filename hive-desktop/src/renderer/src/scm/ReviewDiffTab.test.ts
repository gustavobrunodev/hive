// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewDiffTab } from './ReviewDiffTab'
import { ReviewProvider, type ReviewChange, type ReviewStore } from './useReview'
import type { GitDiff } from './gitStatus'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.hive = {
    readFile: vi.fn(async () => 'BB\nc\n')
  } as unknown as typeof window.hive
})
afterEach(() => cleanup())

const modifiedDiff: GitDiff = {
  binary: false,
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      newStart: 1,
      lines: [
        { type: 'del', oldNo: 1, newNo: null, text: 'B' },
        { type: 'add', oldNo: null, newNo: 1, text: 'BB' },
        { type: 'ctx', oldNo: 2, newNo: 2, text: 'c' }
      ]
    }
  ]
}

function makeStore(changes: ReviewChange[], over?: Partial<ReviewStore>): ReviewStore {
  return {
    workspace: '/ws',
    changes,
    turns: [],
    pendingCount: changes.length,
    byStatus: { created: [], modified: changes, deleted: [] },
    isStale: false,
    refresh: vi.fn(),
    acceptFile: vi.fn(async () => ({ ok: true })),
    acceptFiles: vi.fn(async () => ({ ok: true })),
    rejectFiles: vi.fn(async () => ({ ok: true })),
    rejectFile: vi.fn(async () => ({ ok: true })),
    acceptHunk: vi.fn(async () => ({ ok: true })),
    rejectHunk: vi.fn(async () => ({ ok: true })),
    acceptAll: vi.fn(async () => ({ ok: true })),
    rejectAll: vi.fn(async () => ({ ok: true })),
    staleConflict: null,
    resolveStale: vi.fn(async () => {}),
    ...over
  }
}

function renderTab(store: ReviewStore, path = 'a.txt'): void {
  render(createElement(ReviewProvider, { store }, createElement(ReviewDiffTab, { path })))
}

describe('ReviewDiffTab', () => {
  it('renders the inline overlay for a modified file (reads its text)', async () => {
    const change: ReviewChange = {
      path: 'a.txt',
      status: 'modified',
      diff: modifiedDiff,
      adds: 1,
      dels: 1
    }
    renderTab(makeStore([change]))
    // Inline overlay shows the added line + phantom removed line.
    expect(await screen.findByText('BB')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  it('falls back to the plain DiffView with per-hunk controls for a deleted file', async () => {
    const change: ReviewChange = {
      path: 'gone.txt',
      status: 'deleted',
      diff: {
        binary: false,
        hunks: [
          {
            header: '@@ -1 +0,0 @@',
            oldStart: 1,
            newStart: 0,
            lines: [{ type: 'del', oldNo: 1, newNo: null, text: 'bye' }]
          }
        ]
      },
      adds: 0,
      dels: 1
    }
    const store = makeStore([], {
      changes: [change],
      byStatus: { created: [], modified: [], deleted: [change] }
    })
    renderTab(store, 'gone.txt')
    // The per-hunk ✓/✗ controls come from DiffView's onHunk handlers.
    fireEvent.click(await screen.findByRole('button', { name: /^Aceitar/ }))
    expect(store.acceptHunk).toHaveBeenCalledWith('gone.txt', '0:1:0')
    fireEvent.click(screen.getByRole('button', { name: /^Rejeitar/ }))
    expect(store.rejectHunk).toHaveBeenCalledWith('gone.txt', '0:1:0')
    // A deleted file is never read from disk.
    expect(window.hive.readFile).not.toHaveBeenCalled()
  })

  it('shows the calm empty affordance when the file has left the set', () => {
    renderTab(makeStore([]), 'a.txt')
    expect(screen.getByText('Sem mudanças para revisar')).toBeTruthy()
  })

  it('falls back to the plain DiffView when the file read fails', async () => {
    ;(window.hive.readFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('gone')
    )
    const change: ReviewChange = {
      path: 'a.txt',
      status: 'modified',
      diff: modifiedDiff,
      adds: 1,
      dels: 1
    }
    renderTab(makeStore([change]))
    // With no text, the per-hunk DiffView controls render instead of the inline overlay.
    expect(await screen.findByRole('button', { name: /^Aceitar/ })).toBeTruthy()
  })

  it('renders the calm affordance for a binary change (DiffView, no read needed to inline)', async () => {
    const change: ReviewChange = {
      path: 'img.png',
      status: 'modified',
      diff: { binary: true, hunks: [] },
      adds: 0,
      dels: 0
    }
    renderTab(makeStore([change]), 'img.png')
    expect(await screen.findByText('Arquivo binário')).toBeTruthy()
  })

  it('re-diffs live when the store updates (reads the file again)', async () => {
    const change: ReviewChange = {
      path: 'a.txt',
      status: 'modified',
      diff: modifiedDiff,
      adds: 1,
      dels: 1
    }
    const { rerender } = render(
      createElement(
        ReviewProvider,
        { store: makeStore([change]) },
        createElement(ReviewDiffTab, { path: 'a.txt' })
      )
    )
    await waitFor(() => expect(window.hive.readFile).toHaveBeenCalledTimes(1))

    // The set changes (a hunk accepted → different adds/dels) → re-read.
    const updated: ReviewChange = { ...change, adds: 2, dels: 0 }
    rerender(
      createElement(
        ReviewProvider,
        { store: makeStore([updated]) },
        createElement(ReviewDiffTab, { path: 'a.txt' })
      )
    )
    await waitFor(() => expect(window.hive.readFile).toHaveBeenCalledTimes(2))
  })
})
