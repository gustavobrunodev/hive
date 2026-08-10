// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExportDialog, type ExportDialogProps } from './ExportDialog'
import type { ExportRun } from './exportModel'

/**
 * design-studio T7.4 — DS-R14 AC-3/4, DS-R15, DS-R17.
 *
 * The DS is stood in for with faithful DOM shapes (the `StudioToolbar.test`
 * precedent): Radix's Dialog and Checkbox portal into layers jsdom cannot lay
 * out, and this file is about the dialog's own contract — what is chosen, what
 * is sent, what is reported — not about Radix.
 */
vi.mock('@hive/design-system', () => ({
  Dialog: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogContent: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', { role: 'dialog', ...rest }, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Checkbox: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (next: boolean) => void
  }) =>
    createElement('input', {
      type: 'checkbox',
      checked: checked ?? false,
      onChange: (event: { target: { checked: boolean } }) =>
        onCheckedChange?.(event.target.checked),
      ...rest
    })
}))

afterEach(() => {
  cleanup()
})

const SCREENS = [
  { screenId: 'login', title: 'Login', probe: 'screenHeading' as const },
  { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' as const },
  { screenId: 'sucesso', title: 'Sucesso', probe: 'screenHeading' as const }
]

function run(outcomes: ExportRun['outcomes'], outDir = '/tmp/bundles'): ExportRun {
  return { canceled: false, outDir, outcomes }
}

function renderDialog(overrides: Partial<ExportDialogProps> = {}): ExportDialogProps {
  const props: ExportDialogProps = {
    onClose: vi.fn(),
    screens: SCREENS,
    activeScreenId: 'cadastro',
    onExport: vi.fn().mockResolvedValue(run([])),
    ...overrides
  }
  render(createElement(ExportDialog, props))
  return props
}

function checkbox(title: string): HTMLInputElement {
  return screen.getByLabelText(`Exportar a Tela ${title}`) as HTMLInputElement
}

describe('choosing what to export (DS-R15)', () => {
  it('offers every Tela, with the one in view already chosen', () => {
    renderDialog()

    expect(SCREENS.map((s) => checkbox(s.title).checked)).toEqual([false, true, false])
  })

  it('sends exactly the chosen Telas, in the order the list shows them', async () => {
    const props = renderDialog()

    fireEvent.click(checkbox('Sucesso'))
    fireEvent.click(checkbox('Login'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })

    expect(props.onExport).toHaveBeenCalledWith(['login', 'cadastro', 'sucesso'])
  })

  it('drops a Tela the user unchecked', async () => {
    const props = renderDialog()

    fireEvent.click(checkbox('Login'))
    fireEvent.click(checkbox('Cadastro'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })

    expect(props.onExport).toHaveBeenCalledWith(['login'])
  })

  it('cannot export nothing', () => {
    renderDialog({ activeScreenId: null })
    const confirm = screen.getByRole('button', {
      name: 'Escolher a pasta e exportar'
    }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
  })
})

describe('reading what came of it (DS-R15, DS-R17)', () => {
  it('reports how many landed and where', async () => {
    renderDialog({
      onExport: vi.fn().mockResolvedValue(
        run([
          { screenId: 'login', title: 'Login', ok: true, file: '/tmp/bundles/login.html' },
          { screenId: 'cadastro', title: 'Cadastro', ok: true, file: '/tmp/bundles/cadastro.html' }
        ])
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })

    expect(screen.getByText('2 Telas exportadas em /tmp/bundles')).toBeTruthy()
  })

  it('names the Tela that failed and the reason it gave, and keeps the rest', async () => {
    renderDialog({
      onExport: vi.fn().mockResolvedValue(
        run([
          { screenId: 'login', title: 'Login', ok: true, file: '/tmp/bundles/login.html' },
          {
            screenId: 'cadastro',
            title: 'Cadastro',
            ok: false,
            error: {
              kind: 'operation',
              scope: 'export',
              message: 'O Componente "wa-x" não existe no design system ativo.',
              retryable: true
            }
          },
          { screenId: 'sucesso', title: 'Sucesso', ok: true, file: '/tmp/bundles/sucesso.html' }
        ])
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })

    expect(screen.getByText('2 Telas exportadas em /tmp/bundles')).toBeTruthy()
    expect(screen.getByText('Cadastro')).toBeTruthy()
    expect(screen.getByText('O Componente "wa-x" não existe no design system ativo.')).toBeTruthy()
  })

  it('leaves the picker exactly as it was when the folder picker was closed', async () => {
    renderDialog({
      onExport: vi.fn().mockResolvedValue({ canceled: true, outDir: null, outcomes: [] })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })

    // Cancelling a folder is not a run: no report, and the selection survives.
    expect(screen.queryByRole('status')).toBeNull()
    expect(checkbox('Cadastro').checked).toBe(true)
  })

  it('offers the same selection again after a run', async () => {
    const onExport = vi
      .fn()
      .mockResolvedValue(
        run([{ screenId: 'cadastro', title: 'Cadastro', ok: true, file: '/tmp/b/cadastro.html' }])
      )
    renderDialog({ onExport })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta e exportar' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Exportar de novo' }))
    })

    expect(onExport).toHaveBeenCalledTimes(2)
    expect(onExport).toHaveBeenLastCalledWith(['cadastro'])
  })

  it('closes on the quiet action', () => {
    const props = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
