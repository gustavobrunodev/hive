// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InlineAgentDiff } from './InlineAgentDiff'
import { ReviewProvider, type ReviewChange, type ReviewStore } from './useReview'
import type { GitDiff } from './gitStatus'

// jsdom doesn't implement scrollIntoView.
beforeEachScrollStub()
function beforeEachScrollStub(): void {
  Element.prototype.scrollIntoView = vi.fn()
}

const twoHunkDiff: GitDiff = {
  binary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      newStart: 1,
      lines: [
        { type: 'del', oldNo: 1, newNo: null, text: 'l1' },
        { type: 'add', oldNo: null, newNo: 1, text: 'L1_NEW' }
      ]
    },
    {
      header: '@@ -5 +5 @@',
      oldStart: 5,
      newStart: 5,
      lines: [
        { type: 'del', oldNo: 5, newNo: null, text: 'l5' },
        { type: 'add', oldNo: null, newNo: 5, text: 'L5_NEW' }
      ]
    }
  ]
}

function change(over?: Partial<ReviewChange>): ReviewChange {
  return { path: 'a.txt', status: 'modified', diff: twoHunkDiff, adds: 2, dels: 2, ...over }
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

const FILE = ['L1_NEW', 'l2', 'l3', 'l4', 'L5_NEW'].join('\n')

function renderInline(store: ReviewStore, path = 'a.txt'): void {
  render(
    createElement(
      ReviewProvider,
      { store },
      createElement(InlineAgentDiff, { path, fileText: FILE })
    )
  )
}

afterEach(() => cleanup())

describe('InlineAgentDiff', () => {
  it('renders nothing when the open file is not in the pending set', () => {
    const { container } = render(
      createElement(
        ReviewProvider,
        { store: makeStore([]) },
        createElement(InlineAgentDiff, { path: 'a.txt', fileText: FILE })
      )
    )
    expect(container.querySelector('.wb-inline-diff')).toBeNull()
  })

  it('renders inline added / removed rows for a pending open file', () => {
    renderInline(makeStore([change()]))
    expect(screen.getByText('L1_NEW')).toBeTruthy()
    expect(screen.getByText('l1')).toBeTruthy() // phantom removed row
    // Two hunks → two ✓/✗ strips.
    expect(screen.getAllByRole('button', { name: /^Aceitar/ })).toHaveLength(2)
  })

  it('per-hunk accept/reject call the store with the matching hunkId', () => {
    const store = makeStore([change()])
    renderInline(store)
    fireEvent.click(screen.getAllByRole('button', { name: /^Aceitar/ })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /^Rejeitar/ })[1])
    expect(store.acceptHunk).toHaveBeenCalledWith('a.txt', '0:1:1')
    expect(store.rejectHunk).toHaveBeenCalledWith('a.txt', '1:5:5')
  })

  it('shows the ‹ n de m › nav and moves between hunks', () => {
    renderInline(makeStore([change()]))
    expect(screen.getByText('1 de 2')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Próximo trecho'))
    expect(screen.getByText('2 de 2')).toBeTruthy()
    // Wraps back to the first.
    fireEvent.click(screen.getByLabelText('Próximo trecho'))
    expect(screen.getByText('1 de 2')).toBeTruthy()
  })

  it('supports the keyboard flow: A/R accept/reject the current hunk, J/K navigate', () => {
    const store = makeStore([change()])
    renderInline(store)
    const surface = document.querySelector('.wb-inline-diff') as HTMLElement

    fireEvent.keyDown(surface, { key: 'a' })
    expect(store.acceptHunk).toHaveBeenCalledWith('a.txt', '0:1:1')

    fireEvent.keyDown(surface, { key: 'j' })
    expect(screen.getByText('2 de 2')).toBeTruthy()
    fireEvent.keyDown(surface, { key: 'r' })
    expect(store.rejectHunk).toHaveBeenCalledWith('a.txt', '1:5:5')

    fireEvent.keyDown(surface, { key: 'k' })
    expect(screen.getByText('1 de 2')).toBeTruthy()
    fireEvent.keyDown(surface, { key: 'ArrowDown' })
    expect(screen.getByText('2 de 2')).toBeTruthy()
    fireEvent.keyDown(surface, { key: 'ArrowUp' })
    expect(screen.getByText('1 de 2')).toBeTruthy()

    // An unrelated key is ignored — no further accept/reject calls.
    fireEvent.keyDown(surface, { key: 'x' })
    expect(store.acceptHunk).toHaveBeenCalledTimes(1)
    expect(store.rejectHunk).toHaveBeenCalledTimes(1)
  })

  it('renders the calm affordance for a binary change (no inline rows)', () => {
    const { container } = render(
      createElement(
        ReviewProvider,
        { store: makeStore([change({ diff: { binary: true, hunks: [] } })]) },
        createElement(InlineAgentDiff, { path: 'a.txt', fileText: FILE })
      )
    )
    expect(container.querySelector('.wb-inline-diff')).toBeNull()
  })
})
