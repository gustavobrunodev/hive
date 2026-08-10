// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddComponent } from './AddComponent'
import type { CapabilityViolation, ComponentCatalog, ScreenDocument } from './documentModel'

/**
 * design-studio T5.5 (DS-R7 AC-1/AC-4).
 *
 * The DS is stood in for with faithful DOM shapes (the `Inspector.test`
 * precedent): Radix's Select portals and measures in ways jsdom cannot lay
 * out, and what this file is about is the picker's contract — which tags it may
 * offer, which slots, what Command that produces, and what a refusal does.
 */

const SelectCtx = createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

vi.mock('@hive/design-system', () => ({
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) =>
    createElement('div', { 'data-field': String(label) }, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }) => createElement(SelectCtx.Provider, { value: { value, onValueChange } }, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('span', { ...rest, role: 'combobox' }, children),
  SelectValue: ({ placeholder }: { placeholder?: ReactNode }) =>
    createElement('span', null, useContext(SelectCtx).value ?? placeholder ?? ''),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(SelectCtx)
    return createElement(
      'button',
      { role: 'option', 'data-value': value, onClick: () => ctx.onValueChange?.(value) },
      children
    )
  }
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
    { tag: 'wa-card', slots: ['', 'footer'], props: [] },
    { tag: 'wa-icon', slots: [], props: [] }
  ]
}

const DOC: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: {
    id: 'n1',
    tag: 'wa-page',
    props: {},
    children: [{ id: 'n2', tag: 'wa-card', props: {}, children: [] }]
  }
}

const EMPTY: ScreenDocument = { screenId: 'login', title: 'Login', root: null }

function renderPicker(
  overrides: {
    document?: ScreenDocument
    selectedComponentId?: string | null
    catalog?: ComponentCatalog | null
    refusal?: CapabilityViolation | null
  } = {}
): ReturnType<typeof vi.fn> {
  const onAdd = vi.fn().mockResolvedValue(overrides.refusal ?? null)
  render(
    createElement(AddComponent, {
      catalog: overrides.catalog === undefined ? CATALOG : overrides.catalog,
      document: overrides.document ?? DOC,
      selectedComponentId: overrides.selectedComponentId ?? null,
      onAdd
    })
  )
  return onAdd
}

/** Opens the picker — collapsed by default, so the pane is a tree first. */
function open(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Componente' }))
}

/** The options of one of the two Selects, by its accessible name. */
function optionsOf(name: string): string[] {
  const group = screen.getByRole('combobox', { name }).closest('[data-field]')
  if (!group) throw new Error(`no field for ${name}`)
  return [...group.querySelectorAll('[role="option"]')].map(
    (option) => option.getAttribute('data-value') ?? ''
  )
}

function pick(name: string, value: string): void {
  const group = screen.getByRole('combobox', { name }).closest('[data-field]')
  const option = group?.querySelector(`[role="option"][data-value="${value}"]`)
  if (!option) throw new Error(`no option ${value} in ${name}`)
  fireEvent.click(option)
}

describe('AddComponent — the picker is the catalog (DS-R7 AC-1)', () => {
  it('offers exactly the tags of the active catalog, and no others', () => {
    renderPicker()
    open()
    expect(optionsOf('Componente')).toEqual(['wa-page', 'wa-card', 'wa-icon'])
  })

  it('does not appear at all while the catalog has not arrived', () => {
    renderPicker({ catalog: null })
    expect(screen.queryByRole('button', { name: 'Adicionar Componente' })).toBeNull()
  })

  it('stays collapsed until asked, so the pane reads as a tree', () => {
    renderPicker()
    expect(screen.queryByRole('combobox', { name: 'Componente' })).toBeNull()
  })
})

describe('AddComponent — the slot comes from the parent (DS-R7 AC-4)', () => {
  it('offers exactly the slots the parent declares, the default one included', () => {
    renderPicker({ selectedComponentId: 'n2' })
    open()
    expect(optionsOf('Slot')).toEqual(['', 'footer'])
  })

  it('names the default slot rather than showing an empty option', () => {
    renderPicker({ selectedComponentId: 'n2' })
    open()
    expect(screen.getByText('(padrão)')).toBeTruthy()
  })

  it('follows the selection: a different parent, a different set of slots', () => {
    renderPicker({ selectedComponentId: null })
    open()
    expect(optionsOf('Slot')).toEqual(['', 'header'])
  })

  it('asks for no slot at all when the parent declares none', () => {
    renderPicker({
      document: {
        screenId: 'login',
        title: 'Login',
        root: { id: 'n1', tag: 'wa-icon', props: {}, children: [] }
      }
    })
    open()
    expect(screen.queryByRole('combobox', { name: 'Slot' })).toBeNull()
  })

  it('says where the Component will land, rather than leaving it to be guessed', () => {
    renderPicker({ selectedComponentId: 'n2' })
    open()
    expect(screen.getByText('Dentro de wa-card')).toBeTruthy()
  })

  it('says the first Component of an empty Tela becomes its root', () => {
    renderPicker({ document: EMPTY })
    open()
    expect(screen.getByText('Como o primeiro Componente da Tela')).toBeTruthy()
  })
})

describe('AddComponent — what it dispatches', () => {
  it('emits one AddComponent for the chosen tag, in the chosen slot, under the selection', async () => {
    const onAdd = renderPicker({ selectedComponentId: 'n2' })
    open()
    pick('Componente', 'wa-icon')
    pick('Slot', 'footer')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      type: 'AddComponent',
      parentId: 'n2',
      slot: 'footer',
      index: 0,
      node: { tag: 'wa-icon', props: {}, children: [] }
    })
  })

  it('makes the first Component of an empty Tela its root', async () => {
    const onAdd = renderPicker({ document: EMPTY })
    open()
    pick('Componente', 'wa-page')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ parentId: null, node: { tag: 'wa-page' } })
  })

  it('refuses to dispatch before a Component has been chosen', () => {
    renderPicker()
    open()
    expect((screen.getByRole('button', { name: 'Adicionar' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it('closes once the add has landed', async () => {
    renderPicker({ selectedComponentId: 'n2' })
    open()
    pick('Componente', 'wa-icon')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Componente' })).toBeNull())
  })
})

describe('AddComponent — a refusal is shown, never swallowed (§6)', () => {
  it('renders the CapabilityViolation next to the choice that caused it', async () => {
    renderPicker({
      selectedComponentId: 'n2',
      refusal: {
        kind: 'capability',
        componentId: 'n9',
        reason: 'O slot "footer" não existe em "wa-card" (slots: (padrão)).'
      }
    })
    open()
    pick('Componente', 'wa-icon')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'O slot "footer" não existe em "wa-card" (slots: (padrão)).'
      )
    )
  })

  it('keeps the picker open with the choice intact, so one field can be fixed', async () => {
    renderPicker({
      selectedComponentId: 'n2',
      refusal: { kind: 'capability', componentId: 'n9', reason: 'recusado' }
    })
    open()
    pick('Componente', 'wa-icon')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('combobox', { name: 'Componente' }).textContent).toBe('wa-icon')
  })
})
