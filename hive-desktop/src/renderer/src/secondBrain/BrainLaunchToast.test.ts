// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BrainLaunchToast } from './BrainLaunchToast'

// The DS toast is Radix-backed (portal + timers); stand it in with plain DOM
// that still honors `open` and exposes `onOpenChange`, the GitOpToast test's
// convention.
vi.mock('@hive/design-system', () => ({
  ToastProvider: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  Toast: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          { role: 'status' },
          children,
          // Radix's own auto-dismiss / swipe path.
          createElement(
            'button',
            { type: 'button', 'data-testid': 'auto-dismiss', onClick: () => onOpenChange?.(false) },
            'auto'
          )
        )
      : null,
  ToastViewport: (props: Record<string, unknown>) => createElement('div', props)
}))

function renderToast(key: string | null): {
  onResume: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
} {
  const onResume = vi.fn()
  const onClose = vi.fn()
  render(
    createElement(BrainLaunchToast, {
      launch: key === null ? null : { key, resumeId: 'conv-7' },
      onResume,
      onClose
    })
  )
  return { onResume, onClose }
}

describe('BrainLaunchToast', () => {
  afterEach(() => cleanup())

  it('renders nothing until a command actually opened its own conversation', () => {
    renderToast(null)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("names each command in the user's words, not as a slash command", () => {
    const cases: Array<[string, string]> = [
      ['second-brain', 'Configuração da base abriu uma conversa nova'],
      ['second-brain-ingest', 'Ingestão abriu uma conversa nova'],
      ['second-brain-lint', 'Revisão da base abriu uma conversa nova'],
      ['second-brain-query', 'Pergunta à base abriu uma conversa nova']
    ]
    for (const [key, title] of cases) {
      renderToast(key)
      expect(screen.getByText(title)).toBeTruthy()
      cleanup()
    }
  })

  it('takes the user back to the conversation it backgrounded, and closes', () => {
    const { onResume, onClose } = renderToast('second-brain')

    fireEvent.click(screen.getByText('Voltar para ela'))

    expect(onResume).toHaveBeenCalledWith('conv-7')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on dismiss and on the toast auto-dismissing itself', () => {
    const { onClose, onResume } = renderToast('second-brain-ingest')

    fireEvent.click(screen.getByLabelText('Dispensar aviso'))
    fireEvent.click(screen.getByTestId('auto-dismiss'))

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onResume).not.toHaveBeenCalled()
  })
})
