// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InitiativesPanel } from './InitiativesPanel'
import { INITIATIVES_ROOT, groupInitiatives, type Initiative } from './initiatives'
import type { InitiativesStore } from './useInitiatives'

afterEach(() => {
  cleanup()
})

function initiative(overrides: Partial<Initiative> = {}): Initiative {
  const slug = overrides.slug ?? 'portal-de-cobranca'
  const release = overrides.release ?? 'R2'
  return {
    path: `${INITIATIVES_ROOT}/${release}/${slug}`,
    slug,
    title: 'Portal de Cobrança',
    release,
    year: 2026,
    files: [],
    ...overrides
  }
}

function store(
  initiatives: Initiative[],
  status: InitiativesStore['status'] = 'ready'
): InitiativesStore {
  return {
    status,
    initiatives,
    years: groupInitiatives(initiatives),
    create: vi.fn(),
    refresh: vi.fn()
  }
}

function panel(
  props: Partial<Parameters<typeof InitiativesPanel>[0]> & { store: InitiativesStore }
): ReturnType<typeof render> {
  return render(
    createElement(InitiativesPanel, {
      activePath: null,
      onOpen: vi.fn(),
      onCreate: vi.fn(),
      ...props
    })
  )
}

describe('InitiativesPanel', () => {
  it('draws the year, the release and the demand as one tree', () => {
    panel({ store: store([initiative()]) })
    const tree = screen.getByRole('tree', { name: /Iniciativas por ano/ })
    expect(tree).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('R2')).toBeTruthy()
    expect(screen.getByText('Portal de Cobrança')).toBeTruthy()
  })

  it('opens the newest year and its releases, so the section lands on something', () => {
    // The seed has to survive the store arriving *after* the first render —
    // seeding from the loading state would leave the section closed forever.
    const { rerender } = panel({ store: store([], 'loading') })
    rerender(
      createElement(InitiativesPanel, {
        store: store([initiative()]),
        activePath: null,
        onOpen: vi.fn(),
        onCreate: vi.fn()
      })
    )
    expect(screen.getByText('Portal de Cobrança')).toBeTruthy()
  })

  it('opens the demand that was activated', () => {
    const onOpen = vi.fn()
    panel({ store: store([initiative()]), onOpen })
    fireEvent.click(screen.getByText('Portal de Cobrança'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: 'portal-de-cobranca' }))
  })

  it('leaves a year or a release as scaffolding — clicking one folds it, it does not open anything', () => {
    const onOpen = vi.fn()
    panel({ store: store([initiative()]), onOpen })
    fireEvent.click(screen.getByText('R2'))
    expect(onOpen).not.toHaveBeenCalled()
    // The click folded the release away, which is what a branch row is for.
    expect(screen.queryByText('Portal de Cobrança')).toBeNull()
  })

  it('wears the demand’s progress, and says both numbers in words', () => {
    panel({ store: store([initiative({ files: ['prd.md', 'arquitetura.md'] })]) })
    const chip = screen.getByLabelText('2 de 8 etapas concluídas')
    expect(chip.textContent).toBe('2/8')
    // Untouched is an outline; started takes the accent tint. Shape, not hue alone.
    expect(chip.hasAttribute('data-started')).toBe(true)
    expect(chip.hasAttribute('data-complete')).toBe(false)
  })

  it('invites the first initiative instead of showing an empty tree', () => {
    const onCreate = vi.fn()
    panel({ store: store([]), onCreate })
    expect(screen.queryByRole('tree')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('offers the create action from the header too, where it is always in reach', () => {
    const onCreate = vi.fn()
    panel({ store: store([initiative()]), onCreate })
    fireEvent.click(screen.getByRole('button', { name: 'Nova iniciativa' }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('collapses to give the conversation history the column back', () => {
    panel({ store: store([initiative()]) })
    const toggle = screen.getByRole('button', { name: 'Recolher iniciativas' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    const collapsed = screen.getByRole('button', { name: 'Expandir iniciativas' })
    expect(collapsed.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('tree')).toBeNull()
  })

  it('says it is loading rather than claiming the workspace has none', () => {
    panel({ store: store([], 'loading') })
    expect(screen.getByText('Carregando iniciativas…')).toBeTruthy()
    expect(screen.queryByText('Nenhuma iniciativa ainda')).toBeNull()
  })

  it('marks the open demand as the selected row', () => {
    const open = initiative()
    panel({ store: store([open]), activePath: open.path })
    const row = screen.getByText('Portal de Cobrança').closest('[role="treeitem"]')
    expect(row?.getAttribute('aria-selected')).toBe('true')
  })
})
