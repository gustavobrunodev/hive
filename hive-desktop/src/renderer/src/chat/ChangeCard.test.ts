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
    expect(screen.getByText('2 pendentes')).toBeTruthy()
    expect(screen.getByText('a.txt')).toBeTruthy()
    expect(screen.getByText('b.txt')).toBeTruthy()
  })

  it('expands one file at a time, in place, with its per-hunk controls', () => {
    renderCard(makeStore([change('a.txt'), change('b.txt')]), turn(['a.txt', 'b.txt']))
    expect(screen.queryByRole('button', { name: /^Aceitar o trecho/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ver diferenças de a.txt' }))
    expect(screen.getByRole('button', { name: 'Ocultar diferenças de a.txt' })).toBeTruthy()
    // b.txt stays closed — expanding one file must not dump every pending diff.
    expect(screen.getByRole('button', { name: 'Ver diferenças de b.txt' })).toBeTruthy()
  })

  it('decides the whole turn from the header, in ONE operation', () => {
    const store = makeStore([change('a.txt'), change('b.txt')])
    renderCard(store, turn(['a.txt', 'b.txt']))

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar as 2 alterações deste turno' }))

    // The reported bug: the header looped `acceptFile` per path, so one click
    // approved the files one at a time (and raced itself). It is one decision,
    // so it is one call.
    expect(store.acceptFiles).toHaveBeenCalledWith(['a.txt', 'b.txt'])
    expect(store.acceptFile).not.toHaveBeenCalled()
  })

  it('rejects the whole turn from the header, in ONE operation', () => {
    const store = makeStore([change('a.txt'), change('b.txt')])
    renderCard(store, turn(['a.txt', 'b.txt']))

    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar as 2 alterações deste turno' }))

    expect(store.rejectFiles).toHaveBeenCalledWith(['a.txt', 'b.txt'])
    expect(store.rejectFile).not.toHaveBeenCalled()
  })

  it('decides a single file from its own row', () => {
    const store = makeStore([change('a.txt'), change('b.txt')])
    renderCard(store, turn(['a.txt', 'b.txt']))

    // The per-file affordance the card did not have at all before this rework.
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar a.txt' }))
    expect(store.acceptFile).toHaveBeenCalledWith('a.txt')
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar b.txt' }))
    expect(store.rejectFile).toHaveBeenCalledWith('b.txt')
    // The turn-level batch is a different control and stays untouched.
    expect(store.acceptFiles).not.toHaveBeenCalled()
  })

  it('only offers the batch for files that are still pending', () => {
    // The turn touched two; one is already reviewed and must not be re-decided.
    const store = makeStore([change('a.txt')])
    renderCard(store, turn(['a.txt', 'b.txt']))

    expect(screen.getByText('1 pendente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar a alteração deste turno' }))
    expect(store.acceptFiles).toHaveBeenCalledWith(['a.txt'])
  })

  it('checks off reviewed files and settles into the quiet Revisado state', () => {
    renderCard(makeStore([change('a.txt')]), turn(['a.txt', 'b.txt']))
    const bRow = screen.getByText('b.txt').closest('.wb-change-card-file')!
    expect(bRow.getAttribute('data-reviewed')).toBe('true')

    // Neither pending → the whole card reads "Revisado" with no actions left.
    cleanup()
    renderCard(makeStore([]), turn(['a.txt', 'b.txt']))
    expect(screen.getByText('Revisado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /alterações deste turno/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Ver diferenças/ })).toBeNull()
  })
})
