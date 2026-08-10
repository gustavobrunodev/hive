// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StudioToolbar, type StudioToolbarProps } from './StudioToolbar'
import { DEFAULT_VIEWPORT, viewportForPreset } from './viewport'

/**
 * design-studio T4.4. The DS is stood in for with faithful DOM shapes (the
 * `Explorer.test`/`FileSearchDialog.test` precedent): Radix's Select and
 * Tooltip portal into layers jsdom cannot lay out, and this file is about the
 * toolbar's own contract — what is offered, what is disabled, what is emitted —
 * not about Radix.
 */
const SelectCtx = createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

vi.mock('@hive/design-system', () => ({
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
    createElement('span', rest, children),
  SelectValue: () => createElement('span', null, useContext(SelectCtx).value ?? ''),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(SelectCtx)
    return createElement('button', { onClick: () => ctx.onValueChange?.(value) }, children)
  },
  SegmentedControl: ({
    options,
    value,
    onChange,
    ariaLabel
  }: {
    options: { id: string; label: string }[]
    value: string
    onChange: (id: string) => void
    ariaLabel: string
  }) =>
    createElement(
      'div',
      { role: 'radiogroup', 'aria-label': ariaLabel },
      options.map((option) =>
        createElement(
          'button',
          {
            key: option.id,
            role: 'radio',
            'aria-checked': option.id === value,
            onClick: () => onChange(option.id)
          },
          option.label
        )
      )
    ),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Kbd: ({ children }: { children?: ReactNode }) => createElement('kbd', null, children),
  Tooltip: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipProvider: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children)
}))

afterEach(() => {
  cleanup()
})

const SCREENS = [
  { screenId: 'login', title: 'Login', probe: 'screenHeading' as const },
  { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' as const }
]

function renderToolbar(overrides: Partial<StudioToolbarProps> = {}): StudioToolbarProps {
  const props: StudioToolbarProps = {
    screens: SCREENS,
    activeScreenId: 'login',
    onSelectScreen: vi.fn(),
    viewport: DEFAULT_VIEWPORT,
    onViewportChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    focusMode: false,
    onToggleFocusMode: vi.fn(),
    onExport: vi.fn(),
    ...overrides
  }
  render(createElement(StudioToolbar, props))
  return props
}

describe('StudioToolbar — Telas (DS-R1)', () => {
  it('offers every Tela and reports how many there are', () => {
    const props = renderToolbar()

    expect(screen.getByText('2 Telas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))
    expect(props.onSelectScreen).toHaveBeenCalledWith('cadastro')
  })

  it('says "1 Tela" in the singular — a Spec with one Tela still gets the selector', () => {
    renderToolbar({ screens: [SCREENS[0]] })
    expect(screen.getByText('1 Tela')).toBeTruthy()
  })
})

describe('StudioToolbar — viewport (DS-R3 AC-1)', () => {
  it('shows the active preset without opening anything', () => {
    renderToolbar()
    const desktop = screen.getByRole('radio', { name: 'Desktop' })
    expect(desktop.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Mobile' }).getAttribute('aria-checked')).toBe('false')
  })

  it('emits the real device size for the picked preset', () => {
    const props = renderToolbar()
    fireEvent.click(screen.getByRole('radio', { name: 'Mobile' }))
    expect(props.onViewportChange).toHaveBeenCalledWith({
      presetId: 'mobile',
      width: 390,
      height: 844
    })
  })

  it('hides the custom size fields until the custom segment is chosen', () => {
    renderToolbar()
    expect(screen.queryByLabelText('Largura em pixels')).toBeNull()
  })

  it('edits a custom size through its own fields, clamped', () => {
    const props = renderToolbar({ viewport: { presetId: null, width: 900, height: 700 } })

    expect((screen.getByLabelText('Largura em pixels') as HTMLInputElement).value).toBe('900')
    fireEvent.change(screen.getByLabelText('Largura em pixels'), { target: { value: '5' } })
    expect(props.onViewportChange).toHaveBeenCalledWith({
      presetId: null,
      width: 240,
      height: 700
    })
  })

  it('switching to custom keeps the size the user was already looking at', () => {
    const props = renderToolbar({ viewport: viewportForPreset('tablet') })
    fireEvent.click(screen.getByRole('radio', { name: 'Personalizado' }))
    expect(props.onViewportChange).toHaveBeenCalledWith({
      presetId: null,
      width: 834,
      height: 1112
    })
  })
})

describe('StudioToolbar — history and Focus Mode (DS-R9, DS-R16)', () => {
  it('disables undo and redo when the Tela has no log to walk', () => {
    renderToolbar()
    expect((screen.getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect((screen.getByRole('button', { name: 'Refazer' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it('enables each one exactly when the log says so, and fires it', () => {
    const props = renderToolbar({ canUndo: true, canRedo: false })

    const undo = screen.getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement
    expect(undo.disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Refazer' }) as HTMLButtonElement).disabled).toBe(
      true
    )

    fireEvent.click(undo)
    expect(props.onUndo).toHaveBeenCalledTimes(1)
  })

  it('fires redo when the log has a branch ahead', () => {
    const props = renderToolbar({ canRedo: true })
    fireEvent.click(screen.getByRole('button', { name: 'Refazer' }))
    expect(props.onRedo).toHaveBeenCalledTimes(1)
  })

  it('shows each action keystroke as real keys, not as text', () => {
    renderToolbar()
    const keys = Array.from(document.querySelectorAll('kbd')).map((key) => key.textContent)
    expect(keys).toEqual(['Ctrl', 'Z', 'Ctrl', 'Shift', 'Z', 'Ctrl', 'Shift', '.'])
  })

  it('names the Focus Mode action for the state it will produce', () => {
    const props = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Modo Foco' }))
    expect(props.onToggleFocusMode).toHaveBeenCalledTimes(1)

    cleanup()
    renderToolbar({ focusMode: true })
    expect(screen.getByRole('button', { name: 'Sair do Modo Foco' })).toBeTruthy()
  })

  it('opens the export picker rather than exporting on the spot (T7.4)', () => {
    const props = renderToolbar()
    const button = screen.getByRole('button', { name: 'Exportar' }) as HTMLButtonElement

    expect(button.disabled).toBe(false)
    expect(screen.getByText('Gera um HTML autocontido por Tela')).toBeTruthy()
    fireEvent.click(button)
    expect(props.onExport).toHaveBeenCalledTimes(1)
  })

  it('disables Export only when the Spec named no Tela at all', () => {
    renderToolbar({ screens: [] })
    expect((screen.getByRole('button', { name: 'Exportar' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })
})
