// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReviewBar } from './ReviewBar'
import { ReviewProvider, type ReviewStore } from '../scm/useReview'

function makeStore(over?: Partial<ReviewStore>): ReviewStore {
  return {
    workspace: '/ws',
    changes: [],
    turns: [],
    pendingCount: 0,
    byStatus: { created: [], modified: [], deleted: [] },
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

afterEach(() => cleanup())

describe('ReviewBar', () => {
  it('renders nothing when the set is clean', () => {
    const { container } = render(
      createElement(
        ReviewProvider,
        { store: makeStore() },
        createElement(ReviewBar, { onReview: vi.fn() })
      )
    )
    expect(container.querySelector('.wb-review-bar')).toBeNull()
  })

  it('shows the pending count and the three actions when non-empty', () => {
    render(
      createElement(
        ReviewProvider,
        { store: makeStore({ pendingCount: 3 }) },
        createElement(ReviewBar, { onReview: vi.fn() })
      )
    )
    expect(screen.getByText('3 mudanças pendentes')).toBeTruthy()
    expect(screen.getByText('Aceitar tudo')).toBeTruthy()
    expect(screen.getByText('Rejeitar tudo')).toBeTruthy()
    expect(screen.getByText(/Revisar/)).toBeTruthy()
  })

  it('singularizes the count for one change', () => {
    render(
      createElement(
        ReviewProvider,
        { store: makeStore({ pendingCount: 1 }) },
        createElement(ReviewBar, { onReview: vi.fn() })
      )
    )
    expect(screen.getByText('1 mudança pendente')).toBeTruthy()
  })

  it('accept-all calls the store immediately (no confirm)', () => {
    const store = makeStore({ pendingCount: 2 })
    render(
      createElement(ReviewProvider, { store }, createElement(ReviewBar, { onReview: vi.fn() }))
    )
    fireEvent.click(screen.getByText('Aceitar tudo'))
    expect(store.acceptAll).toHaveBeenCalledTimes(1)
  })

  it('reject-all confirms first, then calls the store on confirm', () => {
    const store = makeStore({ pendingCount: 2 })
    render(
      createElement(ReviewProvider, { store }, createElement(ReviewBar, { onReview: vi.fn() }))
    )
    // First click opens the confirm — store not called yet.
    fireEvent.click(screen.getByText('Rejeitar tudo'))
    expect(store.rejectAll).not.toHaveBeenCalled()
    expect(screen.getByText('Rejeitar todas as mudanças?')).toBeTruthy()

    // Confirm inside the dialog (the danger CTA) fires the action.
    const confirm = screen
      .getAllByText('Rejeitar tudo')
      .find((el) => el.closest('.wb-dialog-actions'))
    fireEvent.click(confirm!)
    expect(store.rejectAll).toHaveBeenCalledTimes(1)
  })

  it('reject-all can be canceled without calling the store', () => {
    const store = makeStore({ pendingCount: 2 })
    render(
      createElement(ReviewProvider, { store }, createElement(ReviewBar, { onReview: vi.fn() }))
    )
    fireEvent.click(screen.getByText('Rejeitar tudo'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(store.rejectAll).not.toHaveBeenCalled()
    expect(screen.queryByText('Rejeitar todas as mudanças?')).toBeNull()
  })

  it('Revisar opens the panel', () => {
    const onReview = vi.fn()
    render(
      createElement(
        ReviewProvider,
        { store: makeStore({ pendingCount: 1 }) },
        createElement(ReviewBar, { onReview })
      )
    )
    fireEvent.click(screen.getByText(/Revisar/))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
})
