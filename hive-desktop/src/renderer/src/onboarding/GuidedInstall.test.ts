// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GuidedInstall } from './GuidedInstall'
import type { BmadEvent } from '../../../main/bmadService'

/**
 * Task T9 — Guided install UI (design.md §5.1, R3.2–R3.4).
 *
 * Same mocking approach as App.test.ts/Explorer.test.ts: `@hive/design-system`
 * gets trivial DOM stand-ins (a real render would load a second React
 * instance from design-system's own node_modules), and `window.hive` is
 * mocked per test since there's no real main process here.
 */
vi.mock('@hive/design-system', () => ({
  Panel: ({ children, ...rest }: { children?: ReactNode }) => createElement('div', rest, children),
  // `cut` is a DS-only prop, not a DOM attribute — drop it so React doesn't
  // warn. The real DS Button always renders `type="button"` (it omits `type`
  // from its props) and so never submits a form on its own — mirror that here
  // so the form's submit path is exercised via the Button's `onClick` (exactly
  // how the app wires it), not via a native submit this stand-in would
  // otherwise fake.
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  },
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement(
      'div',
      { role: 'alert', ...rest },
      createElement('strong', null, title),
      children
    ),
  Progress: () => createElement('div', { role: 'progressbar' }),
  SteppedList: ({ children }: { children?: ReactNode }) => createElement('ol', null, children),
  SteppedListItem: ({ title }: { title?: ReactNode }) => createElement('li', null, title),
  // Guided-install form (BUG 1) controls — trivial DOM stand-ins.
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
      onChange: (e: { target: { checked: boolean } }) => onCheckedChange?.(e.target.checked)
    }),
  Field: ({ label, children }: { label?: ReactNode; children?: ReactNode }) =>
    createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Label: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('label', rest, children),
  RadioGroup: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'radiogroup' }, children),
  RadioGroupItem: ({ id, value }: { id?: string; value?: string }) =>
    createElement('input', { type: 'radio', id, value, name: 'skill', readOnly: true }),
  Select: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SelectValue: () => createElement('span')
}))

describe('GuidedInstall (T9)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockInstallBmad(): {
    emit: (event: BmadEvent) => void
    unsubscribe: ReturnType<typeof vi.fn>
  } {
    let capturedOnEvent: ((event: BmadEvent) => void) | undefined
    const unsubscribe = vi.fn()
    window.hive = {
      ...window.hive,
      installBmad: vi.fn(
        (_workspace: string, _options: unknown, onEvent: (event: BmadEvent) => void) => {
          capturedOnEvent = onEvent
          return unsubscribe
        }
      )
    }
    return {
      emit: (event: BmadEvent) => capturedOnEvent?.(event),
      unsubscribe
    }
  }

  /**
   * The screen now opens on the configuration form (BUG 1) — nothing installs
   * until it's submitted. Submitting it (with the pre-checked recommended
   * module) is what starts `installBmad`, so every "install running" assertion
   * below first drives this. The DS Button is `type="button"`, so the click
   * runs the submit handler via its `onClick` (not a native form submit).
   */
  function submitConfigForm(): void {
    fireEvent.click(screen.getByText('Instalar BMAD'))
  }

  it('shows the config form first and does not install until it is submitted', () => {
    mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))

    // The form is up; nothing has been installed yet.
    expect(screen.getByText('Configurar o BMAD')).toBeTruthy()
    expect(window.hive.installBmad).not.toHaveBeenCalled()
  })

  it('starts installBmad() with the collected options and shows the running state on submit', async () => {
    mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))
    submitConfigForm()

    await waitFor(() => {
      expect(window.hive.installBmad).toHaveBeenCalledWith(
        '/ws',
        expect.objectContaining({ modules: expect.arrayContaining(['bmm']) }),
        expect.any(Function)
      )
    })
    expect(screen.getByText('Preparando seu workspace')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('renders each step event as a SteppedList item, in order', async () => {
    const { emit } = mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))
    submitConfigForm()

    emit({ type: 'step', id: 'install-core', label: 'Instalando módulo core' })
    emit({ type: 'step', id: 'install-bmm', label: 'Instalando módulo bmm' })

    await waitFor(() => {
      expect(screen.getByText('Instalando módulo core')).toBeTruthy()
      expect(screen.getByText('Instalando módulo bmm')).toBeTruthy()
    })
  })

  it('calls onComplete() when the stream reports done', async () => {
    const { emit } = mockInstallBmad()
    const onComplete = vi.fn()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete }))
    submitConfigForm()

    emit({ type: 'done', ok: true })

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  it('shows an Alert with retry on error, and restarts installBmad() when retried', async () => {
    const { emit } = mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))
    submitConfigForm()

    emit({ type: 'error', message: 'Falha na instalação', detail: 'exit code 1' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Falha na instalação')).toBeTruthy()
    })

    expect(window.hive.installBmad).toHaveBeenCalledTimes(1)

    const retryButton = screen.getByText('Tentar novamente')
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(window.hive.installBmad).toHaveBeenCalledTimes(2)
    })
    // Retrying leaves the running state, not the stale error.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('unsubscribes from installBmad() on unmount', () => {
    const { unsubscribe } = mockInstallBmad()

    const { unmount } = render(
      createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} })
    )
    submitConfigForm()
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
