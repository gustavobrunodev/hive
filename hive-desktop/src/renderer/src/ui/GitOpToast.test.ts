// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GitOpToast } from './GitOpToast'

// The DS Toast (Radix) portals/animates in ways jsdom doesn't fully support;
// mock the primitives to render inline when open.
vi.mock('@hive/design-system', async (orig) => {
  const actual = await orig<typeof import('@hive/design-system')>()
  return {
    ...actual,
    ToastProvider: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    Toast: ({
      open,
      children,
      onOpenChange,
      ...rest
    }: {
      open?: boolean
      children?: ReactNode
      onOpenChange?: (open: boolean) => void
    }) =>
      open
        ? createElement(
            'div',
            { role: 'status', ...rest },
            children,
            createElement(
              'button',
              { 'data-testid': 'toast-openchange', onClick: () => onOpenChange?.(false) },
              'x'
            )
          )
        : null,
    ToastViewport: () => null
  }
})

afterEach(() => {
  cleanup()
})

describe('GitOpToast', () => {
  it('renders nothing when there is no result', () => {
    const { container } = render(createElement(GitOpToast, { result: null, onClose: vi.fn() }))
    expect(container.querySelector('.wb-git-toast')).toBeNull()
  })

  it('shows a success message without a details disclosure', () => {
    render(
      createElement(GitOpToast, {
        result: { type: 'success', message: 'Sincronizado com o remoto' },
        onClose: vi.fn()
      })
    )
    expect(screen.getByText('Sincronizado com o remoto')).toBeTruthy()
    expect(screen.queryByText('Detalhes')).toBeNull()
  })

  it('shows an error message with git stderr behind Detalhes (G3)', () => {
    render(
      createElement(GitOpToast, {
        result: {
          type: 'error',
          message: 'A operação de git falhou',
          detail: 'fatal: Authentication failed'
        },
        onClose: vi.fn()
      })
    )
    expect(screen.getByText('A operação de git falhou')).toBeTruthy()
    expect(screen.getByText('Detalhes')).toBeTruthy()
    expect(screen.getByText('fatal: Authentication failed')).toBeTruthy()
  })

  it('dismisses on the close button', () => {
    const onClose = vi.fn()
    render(
      createElement(GitOpToast, {
        result: { type: 'success', message: 'Enviado para o remoto' },
        onClose
      })
    )
    fireEvent.click(screen.getByLabelText('Fechar aviso'))
    expect(onClose).toHaveBeenCalled()
  })

  it('dismisses when the toast auto-closes (onOpenChange false)', () => {
    const onClose = vi.fn()
    render(
      createElement(GitOpToast, {
        result: { type: 'success', message: 'Busca concluída' },
        onClose
      })
    )
    fireEvent.click(screen.getByTestId('toast-openchange'))
    expect(onClose).toHaveBeenCalled()
  })
})
