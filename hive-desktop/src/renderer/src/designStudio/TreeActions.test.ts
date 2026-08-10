// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TreeActions } from './TreeActions'
import type { CapabilityViolation, ComponentCatalog, ScreenDocument } from './documentModel'

/**
 * design-studio T5.6 (DS-R7 AC-2/AC-3/AC-5).
 *
 * The DS is stood in for with faithful DOM shapes (the `Inspector.test`
 * precedent). What is asserted here is the pane's contract: which structural
 * edits are offered for a given selection, what Command each one sends, that a
 * refusal is shown rather than swallowed, and that removing the selected
 * Component clears the selection.
 */

vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) =>
    createElement('div', { 'data-field': String(label) }, children),
  Select: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('span', { ...rest, role: 'combobox' }, children),
  SelectValue: () => createElement('span', null, ''),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) =>
    createElement('button', { role: 'option', 'data-value': value }, children)
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CATALOG: ComponentCatalog = {
  dsId: 'web-awesome',
  version: '3.11.0',
  components: [
    { tag: 'wa-page', slots: ['', 'header'], props: [] },
    { tag: 'wa-card', slots: ['', 'footer'], props: [] }
  ]
}

/** page › [card(button), card] — enough to move inwards, outwards and to remove. */
const DOC: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: {
    id: 'n1',
    tag: 'wa-page',
    props: {},
    children: [
      {
        id: 'n2',
        tag: 'wa-card',
        props: {},
        children: [{ id: 'n3', tag: 'wa-card', props: {}, children: [] }]
      },
      { id: 'n4', tag: 'wa-card', props: {}, children: [] }
    ]
  }
}

function renderActions(
  selectedComponentId: string | null,
  refusal: CapabilityViolation | null = null
): { onEdit: ReturnType<typeof vi.fn>; onSelect: ReturnType<typeof vi.fn> } {
  const onEdit = vi.fn().mockResolvedValue(refusal)
  const onSelect = vi.fn()
  render(
    createElement(TreeActions, {
      catalog: CATALOG,
      document: DOC,
      selectedComponentId,
      onSelect,
      onEdit
    })
  )
  return { onEdit, onSelect }
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

describe('TreeActions — removing (DS-R7 AC-2/AC-5)', () => {
  it('sends one RemoveComponent for the selected Component', async () => {
    const { onEdit } = renderActions('n4')

    fireEvent.click(button('Remover'))

    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
    expect(onEdit.mock.calls[0][0]).toEqual({ type: 'RemoveComponent', componentId: 'n4' })
  })

  it('clears the selection once the removal has landed (DS-R7 AC-5)', async () => {
    const { onSelect } = renderActions('n4')

    fireEvent.click(button('Remover'))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null))
  })

  it('keeps the selection when the removal was refused', async () => {
    const { onSelect } = renderActions('n4', {
      kind: 'capability',
      componentId: 'n4',
      reason: 'recusado'
    })

    fireEvent.click(button('Remover'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('offers nothing to remove while nothing is selected', () => {
    renderActions(null)
    expect(button('Remover').disabled).toBe(true)
  })
})

describe('TreeActions — moving (DS-R7 AC-2)', () => {
  it('moves the selected Component into the sibling above it', async () => {
    const { onEdit } = renderActions('n4')

    fireEvent.click(button('Mover para dentro'))

    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
    expect(onEdit.mock.calls[0][0]).toEqual({
      type: 'MoveComponent',
      componentId: 'n4',
      newParentId: 'n2',
      slot: '',
      index: 1
    })
  })

  it('moves the selected Component out, to sit beside its own parent', async () => {
    const { onEdit } = renderActions('n3')

    fireEvent.click(button('Mover para fora'))

    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
    expect(onEdit.mock.calls[0][0]).toEqual({
      type: 'MoveComponent',
      componentId: 'n3',
      newParentId: 'n1',
      slot: '',
      index: 1
    })
  })

  it('offers no move inwards for a first child, which has no sibling above it', () => {
    renderActions('n3')
    expect(button('Mover para dentro').disabled).toBe(true)
  })

  it('offers no move outwards for a child of the root, which is already outermost', () => {
    renderActions('n2')
    expect(button('Mover para fora').disabled).toBe(true)
  })

  it('offers neither move while nothing is selected', () => {
    renderActions(null)
    expect(button('Mover para dentro').disabled).toBe(true)
    expect(button('Mover para fora').disabled).toBe(true)
  })
})

describe('TreeActions — a refusal is shown, never swallowed (DS-R7 AC-3, §6)', () => {
  it('renders the reason main gave for refusing the move', async () => {
    renderActions('n4', {
      kind: 'capability',
      componentId: 'n4',
      reason:
        'O Componente "wa-card" não pode ser movido para dentro de si mesmo nem de um descendente dele.'
    })

    fireEvent.click(button('Mover para dentro'))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'O Componente "wa-card" não pode ser movido para dentro de si mesmo nem de um descendente dele.'
      )
    )
  })

  it('clears the reason once a later edit lands', async () => {
    const onEdit = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'capability', componentId: 'n4', reason: 'recusado' })
      .mockResolvedValueOnce(null)
    render(
      createElement(TreeActions, {
        catalog: CATALOG,
        document: DOC,
        selectedComponentId: 'n4',
        onSelect: vi.fn(),
        onEdit
      })
    )

    fireEvent.click(button('Mover para dentro'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    fireEvent.click(button('Mover para dentro'))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
