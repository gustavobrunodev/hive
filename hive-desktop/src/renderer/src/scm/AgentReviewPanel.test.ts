// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AgentReviewPanel } from './AgentReviewPanel'
import { ReviewProvider, type ReviewChange, type ReviewStore } from './useReview'

function change(
  path: string,
  status: ReviewChange['status'],
  over?: Partial<ReviewChange>
): ReviewChange {
  return { path, status, diff: { hunks: [], binary: false }, adds: 1, dels: 0, ...over }
}

function makeStore(changes: ReviewChange[], over?: Partial<ReviewStore>): ReviewStore {
  const byStatus = {
    created: changes.filter((c) => c.status === 'created'),
    modified: changes.filter((c) => c.status === 'modified'),
    deleted: changes.filter((c) => c.status === 'deleted')
  }
  return {
    workspace: '/ws',
    changes,
    turns: [],
    pendingCount: changes.length,
    byStatus,
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

function renderPanel(store: ReviewStore, onOpenDiff = vi.fn()): void {
  render(createElement(ReviewProvider, { store }, createElement(AgentReviewPanel, { onOpenDiff })))
}

afterEach(() => cleanup())

describe('AgentReviewPanel', () => {
  it('renders the teaching empty state when there are no changes', () => {
    renderPanel(makeStore([]))
    expect(screen.getByText('Sem mudanças para revisar')).toBeTruthy()
    // No bulk actions when clean.
    expect(screen.queryByText('Aceitar tudo')).toBeNull()
  })

  it('groups changes into Criados/Modificados/Removidos', () => {
    renderPanel(
      makeStore([
        change('src/new.ts', 'created'),
        change('src/mod.ts', 'modified'),
        change('src/gone.ts', 'deleted')
      ])
    )
    expect(screen.getByText('Criados')).toBeTruthy()
    expect(screen.getByText('Modificados')).toBeTruthy()
    expect(screen.getByText('Removidos')).toBeTruthy()
    expect(screen.getByText('new.ts')).toBeTruthy()
    // Directory shown muted next to the basename.
    expect(screen.getAllByText('src').length).toBeGreaterThan(0)
  })

  it('opens a file diff on row click', () => {
    const onOpenDiff = vi.fn()
    renderPanel(makeStore([change('a.txt', 'modified')]), onOpenDiff)
    fireEvent.click(screen.getByLabelText('Abrir diferenças de a.txt'))
    expect(onOpenDiff).toHaveBeenCalledWith('a.txt')
  })

  it('per-row accept/reject call the store', () => {
    const store = makeStore([change('a.txt', 'modified')])
    renderPanel(store)
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar a.txt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar a.txt' }))
    expect(store.acceptFile).toHaveBeenCalledWith('a.txt')
    expect(store.rejectFile).toHaveBeenCalledWith('a.txt')
  })

  it('bulk accept-all is immediate; reject-all confirms first', () => {
    const store = makeStore([change('a.txt', 'modified'), change('b.txt', 'created')])
    renderPanel(store)

    fireEvent.click(screen.getByText('Aceitar tudo'))
    expect(store.acceptAll).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Rejeitar tudo'))
    expect(store.rejectAll).not.toHaveBeenCalled()
    const confirm = screen
      .getAllByText('Rejeitar tudo')
      .find((el) => el.closest('.wb-dialog-actions'))
    fireEvent.click(confirm!)
    expect(store.rejectAll).toHaveBeenCalledTimes(1)
  })
})
