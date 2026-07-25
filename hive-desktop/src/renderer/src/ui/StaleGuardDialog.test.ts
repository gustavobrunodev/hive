// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StaleGuardDialog } from './StaleGuardDialog'
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

function renderDialog(store: ReviewStore): void {
  render(createElement(ReviewProvider, { store }, createElement(StaleGuardDialog, {})))
}

afterEach(() => cleanup())

describe('StaleGuardDialog', () => {
  it('renders nothing when there is no conflict', () => {
    renderDialog(makeStore())
    expect(screen.queryByText('Arquivo alterado por você')).toBeNull()
  })

  it('shows the conflict path and routes each choice to resolveStale', () => {
    const resolveStale = vi.fn(async () => {})
    const store = makeStore({ staleConflict: { path: 'src/a.txt' }, resolveStale })
    renderDialog(store)

    expect(screen.getByText('Arquivo alterado por você')).toBeTruthy()
    expect(screen.getByText(/src\/a\.txt/)).toBeTruthy()

    fireEvent.click(screen.getByText('Manter minhas edições'))
    expect(resolveStale).toHaveBeenCalledWith('mine')

    fireEvent.click(screen.getByText('Usar a do agente'))
    expect(resolveStale).toHaveBeenCalledWith('agent')

    fireEvent.click(screen.getByText('Cancelar'))
    expect(resolveStale).toHaveBeenCalledWith('cancel')
  })
})
