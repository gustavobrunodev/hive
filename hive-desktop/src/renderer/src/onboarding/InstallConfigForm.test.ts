// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { InstallConfigForm } from './InstallConfigForm'
import { BMAD_MODULE_CATALOG } from './bmadInstallCatalog'

/**
 * P1-004 (BUG 1) — the guided install form is how the app keeps its "terminal
 * abstracted into visual UI" contract: the answers collected here become the
 * non-interactive `bmad-method install` flags. What matters, and what sat
 * uncovered at 40% of functions, is the **payload** it emits and the one rule
 * it enforces (at least one module). A wrong payload here misconfigures the
 * user's whole workspace, silently.
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  },
  Alert: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', { role: 'alert', ...rest }, children),
  Checkbox: ({
    id,
    checked,
    onCheckedChange
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) =>
    createElement('input', {
      type: 'checkbox',
      id,
      checked: Boolean(checked),
      onChange: (event: { target: { checked: boolean } }) => onCheckedChange?.(event.target.checked)
    }),
  Field: ({ label, children }: { label?: ReactNode; children?: ReactNode }) =>
    createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Label: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('label', rest, children),
  RadioGroup: ({
    children,
    value,
    onValueChange
  }: {
    children?: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) =>
    createElement(
      'div',
      {
        role: 'radiogroup',
        'data-value': value,
        onClick: (event: { target: HTMLElement }) => {
          const picked = (event.target as HTMLInputElement).value
          if (picked) onValueChange?.(picked)
        }
      },
      children
    ),
  RadioGroupItem: ({ id, value }: { id?: string; value?: string }) =>
    createElement('input', { type: 'radio', id, value, name: 'skill', readOnly: true }),
  Select: ({
    children,
    value,
    onValueChange
  }: {
    children?: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) =>
    createElement(
      'div',
      {
        'data-value': value,
        onClick: (event: { target: HTMLElement }) => {
          const picked = (event.target as HTMLElement).dataset.value
          if (picked) onValueChange?.(picked)
        }
      },
      children
    ),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children, value }: { children?: ReactNode; value?: string }) =>
    createElement('div', { 'data-value': value }, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SelectValue: () => createElement('span')
}))

function submit(): void {
  fireEvent.click(screen.getByText('Instalar BMAD'))
}

/** The checkbox of one catalog module, by its label's `htmlFor` id. */
function moduleBox(id: string): HTMLInputElement {
  return document.getElementById(`bmad-module-${id}`) as HTMLInputElement
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('InstallConfigForm (P1-004)', () => {
  it('pre-checks exactly the recommended modules', () => {
    render(createElement(InstallConfigForm, { onSubmit: vi.fn() }))

    for (const module of BMAD_MODULE_CATALOG) {
      expect(moduleBox(module.id).checked).toBe(Boolean(module.recommended))
    }
  })

  it('submits the recommended defaults, with the skill level scoped to bmm', () => {
    const onSubmit = vi.fn()
    render(createElement(InstallConfigForm, { onSubmit }))

    submit()

    expect(onSubmit).toHaveBeenCalledWith({
      modules: ['bmm'],
      userName: undefined,
      communicationLanguage: 'English',
      documentOutputLanguage: 'English',
      set: { 'bmm.user_skill_level': 'intermediate' }
    })
  })

  it('carries the typed name, trimmed, and omits it when blank', () => {
    const onSubmit = vi.fn()
    render(createElement(InstallConfigForm, { onSubmit }))
    const name = screen.getByPlaceholderText('Seu nome ou o nome do time')

    fireEvent.change(name, { target: { value: '  Gustavo  ' } })
    submit()
    expect(onSubmit.mock.calls[0][0].userName).toBe('Gustavo')

    fireEvent.change(name, { target: { value: '   ' } })
    submit()
    expect(onSubmit.mock.calls[1][0].userName).toBeUndefined()
  })

  it('refuses an empty module set and says why, instead of installing nothing', () => {
    const onSubmit = vi.fn()
    render(createElement(InstallConfigForm, { onSubmit }))

    fireEvent.click(moduleBox('bmm'))
    submit()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Selecione ao menos um módulo')

    // Checking one again clears the complaint and lets it through.
    fireEvent.click(moduleBox('bmb'))
    expect(screen.queryByRole('alert')).toBeNull()
    submit()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ modules: ['bmb'] }))
  })

  it('omits the bmm-only `--set` when bmm is not being installed', () => {
    const onSubmit = vi.fn()
    render(createElement(InstallConfigForm, { onSubmit }))

    fireEvent.click(moduleBox('bmm'))
    fireEvent.click(moduleBox('bmb'))
    submit()

    // The skill-level question isn't even asked when it would mean nothing.
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ modules: ['bmb'], set: undefined })
    )
  })

  it('adds a module to the set without dropping the ones already picked', () => {
    const onSubmit = vi.fn()
    render(createElement(InstallConfigForm, { onSubmit }))

    fireEvent.click(moduleBox('bmb'))
    submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ modules: ['bmm', 'bmb'] }))
  })

  it('submits on Enter in the form, not only via the button', () => {
    const onSubmit = vi.fn()
    const { container } = render(createElement(InstallConfigForm, { onSubmit }))

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
