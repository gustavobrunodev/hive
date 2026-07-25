// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChangeCard } from './ChangeCard'
import {
  ReviewProvider,
  type ReviewChange,
  type ReviewStore,
  type TurnMark
} from '../scm/useReview'
import type { GitDiff } from '../scm/gitStatus'

const diff: GitDiff = {
  binary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      newStart: 1,
      lines: [
        { type: 'del', oldNo: 1, newNo: null, text: 'a' },
        { type: 'add', oldNo: null, newNo: 1, text: 'A' }
      ]
    }
  ]
}

function change(path: string, status: ReviewChange['status'] = 'modified'): ReviewChange {
  return { path, status, diff, adds: 1, dels: 1 }
}

function makeStore(changes: ReviewChange[], over?: Partial<ReviewStore>): ReviewStore {
  return {
    workspace: '/ws',
    changes,
    turns: [],
    pendingCount: changes.length,
    byStatus: {
      created: changes.filter((c) => c.status === 'created'),
      modified: changes.filter((c) => c.status === 'modified'),
      deleted: changes.filter((c) => c.status === 'deleted')
    },
    isStale: false,
    refresh: vi.fn(),
    acceptFile: vi.fn(async () => ({ ok: true })),
    rejectFile: vi.fn(async () => ({ ok: true })),
    acceptHunk: vi.fn(async () => ({ ok: true })),
    rejectHunk: vi.fn(async () => ({ ok: true })),
    acceptAll: vi.fn(async () => ({ ok: true })),
    rejectAll: vi.fn(async () => ({ ok: true })),
    ...over
  }
}

function renderCard(store: ReviewStore, turn: TurnMark): void {
  render(createElement(ReviewProvider, { store }, createElement(ChangeCard, { turn })))
}

const turn = (paths: string[]): TurnMark => ({ turnId: 't1', at: 1, paths })

afterEach(() => cleanup())

describe('ChangeCard', () => {
  it('renders nothing for a turn that touched no files', () => {
    const { container } = render(
      createElement(
        ReviewProvider,
        { store: makeStore([]) },
        createElement(ChangeCard, { turn: turn([]) })
      )
    )
    expect(container.querySelector('.wb-change-card')).toBeNull()
  })

  it('lists the turn’s files with +/- counts and the "Editei N" header', () => {
    renderCard(
      makeStore([change('src/a.txt'), change('src/b.txt')]),
      turn(['src/a.txt', 'src/b.txt'])
    )
    expect(screen.getByText('Editei 2 arquivos')).toBeTruthy()
    expect(screen.getByText('a.txt')).toBeTruthy()
    expect(screen.getByText('b.txt')).toBeTruthy()
  })

  it('expands to show a per-file diff with per-hunk controls', () => {
    renderCard(makeStore([change('a.txt')]), turn(['a.txt']))
    // Collapsed: no diff hunk controls yet.
    expect(screen.queryByRole('button', { name: /^Aceitar o trecho/ })).toBeNull()
    fireEvent.click(screen.getByText('Ver diferenças'))
    // Expanded: the DiffView per-hunk ✓/✗ appear.
    expect(screen.getByText('Ocultar diferenças')).toBeTruthy()
  })

  it('turn-level accept applies to every pending file', () => {
    const store = makeStore([change('a.txt'), change('b.txt')])
    renderCard(store, turn(['a.txt', 'b.txt']))
    // The header's turn-level accept (the ✓ button whose target is "2 arquivos").
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar Editei 2 arquivos' }))
    expect(store.acceptFile).toHaveBeenCalledWith('a.txt')
    expect(store.acceptFile).toHaveBeenCalledWith('b.txt')
  })

  it('turn-level reject applies to every pending file', () => {
    const store = makeStore([change('a.txt')])
    renderCard(store, turn(['a.txt']))
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar Editei 1 arquivo' }))
    expect(store.rejectFile).toHaveBeenCalledWith('a.txt')
  })

  it('checks off reviewed files and settles into the quiet Revisado state', () => {
    // The turn touched two files; only one is still pending → one checked off.
    renderCard(makeStore([change('a.txt')]), turn(['a.txt', 'b.txt']))
    const bRow = screen.getByText('b.txt').closest('.wb-change-card-file')!
    expect(bRow.getAttribute('data-reviewed')).toBe('true')

    // Neither pending → the whole card reads "Revisado" with no actions.
    cleanup()
    renderCard(makeStore([]), turn(['a.txt', 'b.txt']))
    expect(screen.getByText('Revisado')).toBeTruthy()
    expect(screen.queryByText('Ver diferenças')).toBeNull()
  })
})
