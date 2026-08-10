// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Inspector, TEXT_DEBOUNCE_MS, type InspectorProps } from './Inspector'
import type { ComponentCatalog, ScreenDocument } from './documentModel'

/**
 * design-studio T5.2 (DS-R6 AC-1/AC-2).
 *
 * The DS is stood in for with faithful DOM shapes (the `StudioToolbar.test`
 * precedent): Radix's Select and Accordion portal and animate in ways jsdom
 * cannot lay out, and this file is about the Inspector's own contract — which
 * control each prop gets, which props appear at all, and how they are grouped.
 *
 * The catalog is the **real one** the build froze from the package's CEM, not
 * a fixture. That is the whole point of DS-R6: if `wa-button.variant` ever
 * stops being those five values, this test has to notice.
 */

const SelectCtx = createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

vi.mock('@hive/design-system', () => ({
  Field: ({
    label,
    error,
    children
  }: {
    label: ReactNode
    error?: ReactNode
    children: ReactNode
  }) =>
    createElement('div', { 'data-field': String(label) }, [
      createElement('span', { key: 'l' }, label),
      children,
      error ? createElement('p', { key: 'e', role: 'alert' }, error) : null
    ]),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (value: boolean) => void
  }) =>
    createElement('button', {
      ...rest,
      role: 'switch',
      'aria-checked': checked ? 'true' : 'false',
      onClick: () => onCheckedChange?.(!checked)
    }),
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
  SelectValue: () => createElement('span', null, useContext(SelectCtx).value ?? ''),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(SelectCtx)
    return createElement(
      'button',
      { role: 'option', 'data-value': value, onClick: () => ctx.onValueChange?.(value) },
      children
    )
  },
  Accordion: ({ children, defaultValue }: { children?: ReactNode; defaultValue?: string[] }) =>
    createElement('div', { 'data-open': (defaultValue ?? []).join(' ') }, children),
  AccordionItem: ({ children, value }: { children?: ReactNode; value: string }) =>
    createElement('section', { 'data-group': value }, children),
  AccordionTrigger: ({ children }: { children?: ReactNode }) => createElement('h3', null, children),
  AccordionContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children)
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The catalog the build froze from `custom-elements.json` (D-DS-5). */
const CATALOG = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../resources/design-system-web-awesome/catalog.json'),
    'utf-8'
  )
) as ComponentCatalog

function docWith(
  tag: string,
  props: Record<string, string | number | boolean> = {}
): ScreenDocument {
  return {
    screenId: 'login',
    title: 'Login',
    root: { id: 'n1', tag, props, children: [] }
  }
}

function renderInspector(overrides: Partial<InspectorProps> = {}): InspectorProps {
  const props: InspectorProps = {
    catalog: CATALOG,
    document: docWith('wa-button'),
    selectedComponentId: 'n1',
    onChange: vi.fn().mockResolvedValue(null),
    ...overrides
  }
  render(createElement(Inspector, props))
  return props
}

/** The values a prop's Select offers, in catalog order. */
function optionsFor(propName: string): string[] {
  const field = document.querySelector(`[data-field="${propName}"]`)
  return Array.from(field?.querySelectorAll('[role="option"]') ?? []).map(
    (option) => option.getAttribute('data-value') ?? ''
  )
}

/** Every prop the Inspector is offering, whatever its control. */
function offeredProps(): string[] {
  return Array.from(document.querySelectorAll('[data-field]')).map(
    (field) => field.getAttribute('data-field') ?? ''
  )
}

describe('Inspector — the catalog chooses the control (DS-R6 AC-2)', () => {
  it('offers wa-button’s variant as a select with exactly the catalog’s five values', () => {
    renderInspector()

    expect(optionsFor('variant')).toEqual(['neutral', 'brand', 'success', 'warning', 'danger'])
  })

  it('gives a boolean prop a switch, reflecting the value the document holds', () => {
    renderInspector({ document: docWith('wa-button', { pill: true }) })

    const pill = document.querySelector('[data-field="pill"] [role="switch"]')
    expect(pill?.getAttribute('aria-checked')).toBe('true')
    expect(document.querySelector('[data-field="disabled"] [role="switch"]')).toBeTruthy()
  })

  it('gives a string prop a text field carrying its current value', () => {
    renderInspector({ document: docWith('wa-button', { name: 'entrar' }) })

    const name = document.querySelector('[data-field="name"] input') as HTMLInputElement
    expect(name.type).toBe('text')
    expect(name.value).toBe('entrar')
  })

  it('shows an unset prop as empty rather than inventing a value', () => {
    renderInspector()
    expect((document.querySelector('[data-field="name"] input') as HTMLInputElement).value).toBe('')
  })

  // Text carries the same contract but on a 120 ms delay (R-6); its value and
  // its timing are asserted together in the T5.3 debounce test below.
  it('reports each change as the prop’s name and its new value', () => {
    const props = renderInspector()

    fireEvent.click(screen.getByText('brand'))
    expect(props.onChange).toHaveBeenCalledWith('variant', 'brand')

    fireEvent.click(document.querySelector('[data-field="pill"] [role="switch"]')!)
    expect(props.onChange).toHaveBeenCalledWith('pill', true)
  })
})

describe('Inspector — only what the catalog declares (DS-R6 AC-1)', () => {
  it('offers exactly the props the catalog lists for the selected Component', () => {
    renderInspector()

    const declared = CATALOG.components
      .find((component) => component.tag === 'wa-button')!
      .props.map((prop) => prop.name)
    expect(offeredProps().sort()).toEqual([...declared].sort())
  })

  it('never offers a prop the document happens to carry but the catalog does not declare', () => {
    renderInspector({ document: docWith('wa-button', { inventada: 'x' }) })
    expect(offeredProps()).not.toContain('inventada')
  })

  it('offers a different Component’s own props, not the previous one’s', () => {
    renderInspector({ document: docWith('wa-card') })

    const declared = CATALOG.components
      .find((component) => component.tag === 'wa-card')!
      .props.map((prop) => prop.name)
    expect(offeredProps().sort()).toEqual([...declared].sort())
  })

  it('renders nothing when the selected tag is not in the active catalog', () => {
    renderInspector({ document: docWith('wa-inexistente') })
    expect(offeredProps()).toEqual([])
  })

  it('renders nothing while the catalog has not arrived yet', () => {
    renderInspector({ catalog: null })
    expect(offeredProps()).toEqual([])
  })
})

describe('Inspector — grouped, with the long tail closed (design §3.6)', () => {
  it('orders the groups Aparência → Estado → Conteúdo → Avançado', () => {
    renderInspector()
    expect(
      Array.from(document.querySelectorAll('[data-group]')).map((section) =>
        section.getAttribute('data-group')
      )
    ).toEqual(['appearance', 'state', 'content', 'advanced'])
  })

  it('puts each prop in the group the catalog assigned it', () => {
    renderInspector()
    const appearance = Array.from(
      document.querySelectorAll('[data-group="appearance"] [data-field]')
    ).map((field) => field.getAttribute('data-field'))

    expect(appearance).toContain('variant')
    expect(appearance).toContain('size')
    expect(appearance).not.toContain('disabled')
  })

  it('opens every group except Avançado, which is where the 20 rare props live', () => {
    renderInspector()
    const open = document.querySelector('[data-open]')?.getAttribute('data-open')?.split(' ')

    expect(open).toContain('appearance')
    expect(open).toContain('state')
    expect(open).not.toContain('advanced')
  })

  it('leaves out a group the Component has no props for, rather than showing an empty heading', () => {
    renderInspector({
      catalog: {
        dsId: 'test',
        version: '1',
        components: [
          {
            tag: 'wa-divider',
            slots: [''],
            props: [{ name: 'orientation', kind: 'string', group: 'appearance' }]
          }
        ]
      },
      document: docWith('wa-divider')
    })

    expect(
      Array.from(document.querySelectorAll('[data-group]')).map((section) =>
        section.getAttribute('data-group')
      )
    ).toEqual(['appearance'])
  })
})

/**
 * design-studio T5.3 (DS-R6 AC-3/AC-4, R-6). What happens between the control
 * and the document: one `SetProp` per change, text coalesced at 120 ms, and a
 * refusal shown where it was typed with nothing applied.
 */
describe('Inspector — dispatching a change (DS-R6 AC-3)', () => {
  it('reports an enum pick immediately, with no timer in the way', () => {
    vi.useFakeTimers()
    const props = renderInspector()

    fireEvent.click(screen.getByText('brand'))

    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith('variant', 'brand')
    vi.useRealTimers()
  })

  it('reports a switch immediately too', () => {
    vi.useFakeTimers()
    const props = renderInspector()

    fireEvent.click(document.querySelector('[data-field="disabled"] [role="switch"]')!)

    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith('disabled', true)
    vi.useRealTimers()
  })

  it('holds a text change for 120 ms, then sends exactly one', () => {
    vi.useFakeTimers()
    const props = renderInspector()
    const field = document.querySelector('[data-field="name"] input') as HTMLInputElement

    fireEvent.change(field, { target: { value: 'e' } })
    fireEvent.change(field, { target: { value: 'en' } })
    fireEvent.change(field, { target: { value: 'ent' } })

    // The field is live even though nothing has been dispatched yet.
    expect(field.value).toBe('ent')
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS - 1)
    expect(props.onChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith('name', 'ent')
    vi.useRealTimers()
  })

  it('sends a number field as a number, not as the text of one', () => {
    vi.useFakeTimers()
    const props = renderInspector({
      catalog: {
        dsId: 'test',
        version: '1',
        components: [
          {
            tag: 'wa-progress',
            slots: [''],
            props: [{ name: 'value', kind: 'number', group: 'content' }]
          }
        ]
      },
      document: docWith('wa-progress')
    })

    fireEvent.change(document.querySelector('[data-field="value"] input')!, {
      target: { value: '42' }
    })
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)

    expect(props.onChange).toHaveBeenCalledWith('value', 42)
    vi.useRealTimers()
  })
})

describe('Inspector — a refused value (DS-R6 AC-4)', () => {
  const REFUSAL = {
    kind: 'capability' as const,
    componentId: 'n1',
    reason: '"roxo" não é um valor válido para "variant" em "wa-button".',
    attemptedValue: 'roxo'
  }

  it('shows the violation inside the Field that caused it, and applies nothing', async () => {
    const props = renderInspector({
      document: docWith('wa-button', { variant: 'neutral' }),
      onChange: vi.fn().mockResolvedValue(REFUSAL)
    })

    fireEvent.click(screen.getByText('brand'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    const field = document.querySelector('[data-field="variant"]')!
    expect(field.querySelector('[role="alert"]')?.textContent).toBe(REFUSAL.reason)
    // The control still shows what the document holds — the change never landed.
    expect(field.querySelector('[role="combobox"]')?.textContent).toBe('neutral')
    expect(props.onChange).toHaveBeenCalledTimes(1)
  })

  it('puts the violation on the offending prop only, leaving the others clean', async () => {
    renderInspector({ onChange: vi.fn().mockResolvedValue(REFUSAL) })

    fireEvent.click(screen.getByText('brand'))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))

    expect(document.querySelector('[data-field="size"] [role="alert"]')).toBeNull()
  })

  it('clears the violation as soon as a value is accepted', async () => {
    let answer: typeof REFUSAL | null = REFUSAL
    renderInspector({ onChange: vi.fn(async () => answer) })

    fireEvent.click(screen.getByText('brand'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    answer = null
    fireEvent.click(screen.getByText('success'))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
