// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecondBrainFab } from './SecondBrainFab'

describe('SecondBrainFab (T9)', () => {
  afterEach(() => cleanup())

  function renderFab(): {
    onSelectMode: ReturnType<typeof vi.fn>
    onAsk: ReturnType<typeof vi.fn>
    trigger: HTMLElement
  } {
    const onSelectMode = vi.fn()
    const onAsk = vi.fn()
    render(createElement(SecondBrainFab, { onSelectMode, onAsk }))
    return {
      onSelectMode,
      onAsk,
      trigger: screen.getByLabelText('Base de conhecimento — perguntar ou capturar')
    }
  }

  it('is a quiet closed button until activated (aria-haspopup/expanded)', () => {
    const { trigger } = renderFab()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('leads the menu with "Perguntar à base", then the three capture modes (SB-R3.1, SB-R9.1)', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual([
      'Perguntar à baseCtrl+Shift+K',
      'Colar texto',
      'Áudio (arquivo)',
      'Gravar áudio'
    ])
  })

  it('opens the ask surface from the menu and closes (SB-R9.1)', () => {
    const { onAsk, onSelectMode, trigger } = renderFab()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Perguntar à base'))

    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(onSelectMode).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows the health-check reminder in its own stack, and hides it while the menu is open (SB-R10.4)', () => {
    render(
      createElement(SecondBrainFab, {
        onSelectMode: vi.fn(),
        onAsk: vi.fn(),
        nudge: createElement('div', { 'data-testid': 'nudge' })
      })
    )
    const trigger = screen.getByLabelText('Base de conhecimento — perguntar ou capturar')

    expect(screen.getByTestId('nudge')).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.queryByTestId('nudge')).toBeNull()
  })

  it('reports the picked mode and closes the menu', () => {
    const { onSelectMode, trigger } = renderFab()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Colar texto'))
    expect(onSelectMode).toHaveBeenCalledWith('text')
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Áudio (arquivo)'))
    expect(onSelectMode).toHaveBeenLastCalledWith('audioFile')

    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Gravar áudio'))
    expect(onSelectMode).toHaveBeenLastCalledWith('record')
  })

  it('toggles closed when the trigger is clicked again', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Escape closes the menu and returns focus to the button (keyboard reachable, SB-R3.5)', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('a click outside dismisses the menu without refocusing', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a click inside the menu container does not dismiss it', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('unsubscribes its document listeners on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(
      createElement(SecondBrainFab, { onSelectMode: vi.fn(), onAsk: vi.fn() })
    )
    fireEvent.click(screen.getByLabelText('Base de conhecimento — perguntar ou capturar'))
    unmount()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })
})
