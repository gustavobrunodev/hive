// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GuidedTour } from './GuidedTour'

/**
 * Guided tour tests (first-access onboarding): welcome step, anchor-driven
 * stops, skip-at-any-moment (button + Esc), arrow-key navigation, and the
 * degenerate no-anchors case. Anchors are plain `[data-tour]` DOM elements
 * appended per test — the tour resolves them itself at open time.
 */
describe('GuidedTour', () => {
  afterEach(() => {
    cleanup()
    document.querySelectorAll('[data-tour]').forEach((el) => el.remove())
    vi.restoreAllMocks()
  })

  function addAnchor(id: string): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-tour', id)
    document.body.appendChild(el)
    return el
  }

  it('renders nothing while closed', () => {
    render(createElement(GuidedTour, { open: false, onClose: vi.fn() }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens on the welcome step, greeting by name when known', () => {
    render(createElement(GuidedTour, { open: true, userName: 'Gustavo', onClose: vi.fn() }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Olá Gustavo, boas-vindas ao Hive')).toBeTruthy()
    expect(screen.getByText('Passo 1 de 1')).toBeTruthy()
  })

  it('walks the anchored stops with Próximo and finishes with Concluir', () => {
    addAnchor('shortcuts')
    addAnchor('composer')
    const onClose = vi.fn()
    render(createElement(GuidedTour, { open: true, onClose }))

    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    fireEvent.click(screen.getByText('Começar'))
    expect(screen.getByText('Seus atalhos')).toBeTruthy()

    fireEvent.click(screen.getByText('Próximo'))
    expect(screen.getByText('Converse do seu jeito')).toBeTruthy()

    // Last stop: the primary action concludes (and only then closes).
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Concluir'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Voltar returns to the previous stop', () => {
    addAnchor('shortcuts')
    render(createElement(GuidedTour, { open: true, onClose: vi.fn() }))
    fireEvent.click(screen.getByText('Começar'))
    expect(screen.getByText('Seus atalhos')).toBeTruthy()

    fireEvent.click(screen.getByText('Voltar'))
    expect(screen.getByText('Boas-vindas ao Hive')).toBeTruthy()
  })

  it('skips at any moment via "Pular tour"', () => {
    addAnchor('shortcuts')
    const onClose = vi.fn()
    render(createElement(GuidedTour, { open: true, onClose }))
    fireEvent.click(screen.getByText('Começar'))

    fireEvent.click(screen.getByText('Pular tour'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape skips from anywhere; arrows navigate', () => {
    addAnchor('shortcuts')
    const onClose = vi.fn()
    render(createElement(GuidedTour, { open: true, onClose }))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Seus atalhos')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Boas-vindas ao Hive')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('drops stops whose anchor is not on screen', () => {
    addAnchor('profile')
    render(createElement(GuidedTour, { open: true, onClose: vi.fn() }))
    // welcome + profile only — the other four anchors don't exist.
    expect(screen.getByText('Passo 1 de 2')).toBeTruthy()
    fireEvent.click(screen.getByText('Começar'))
    expect(screen.getByText('Deixe com a sua cara')).toBeTruthy()
  })
})
