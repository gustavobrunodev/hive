// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReviewSwitchDialog } from './ReviewSwitchDialog'

afterEach(() => cleanup())

describe('ReviewSwitchDialog', () => {
  function renderDialog(count = 3): {
    onAcceptAll: ReturnType<typeof vi.fn>
    onRejectAll: ReturnType<typeof vi.fn>
    onKeep: ReturnType<typeof vi.fn>
    onCancel: ReturnType<typeof vi.fn>
  } {
    const handlers = {
      onAcceptAll: vi.fn(),
      onRejectAll: vi.fn(),
      onKeep: vi.fn(),
      onCancel: vi.fn()
    }
    render(createElement(ReviewSwitchDialog, { count, ...handlers }))
    return handlers
  }

  it('shows the pending count and routes each choice', () => {
    const h = renderDialog(3)
    expect(screen.getByText('Sair com mudanças pendentes?')).toBeTruthy()
    expect(screen.getByText(/3 mudanças do agente/)).toBeTruthy()

    fireEvent.click(screen.getByText('Aceitar tudo e sair'))
    expect(h.onAcceptAll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Rejeitar tudo e sair'))
    expect(h.onRejectAll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Sair mantendo pendentes'))
    expect(h.onKeep).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(h.onCancel).toHaveBeenCalledTimes(1)
  })

  it('singularizes the description for one change', () => {
    renderDialog(1)
    expect(screen.getByText(/1 mudança do agente ainda não revisada/)).toBeTruthy()
  })
})
