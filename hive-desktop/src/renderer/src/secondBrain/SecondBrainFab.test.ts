// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecondBrainFab } from './SecondBrainFab'

describe('SecondBrainFab (T9)', () => {
  afterEach(() => cleanup())

  function renderFab(): { onSelectMode: ReturnType<typeof vi.fn>; trigger: HTMLElement } {
    const onSelectMode = vi.fn()
    render(createElement(SecondBrainFab, { onSelectMode }))
    return { onSelectMode, trigger: screen.getByLabelText('Ingerir conhecimento') }
  }

  it('is a quiet closed button until activated (aria-haspopup/expanded)', () => {
    const { trigger } = renderFab()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens a three-item menu with the ingestion modes (SB-R3.1)', () => {
    const { trigger } = renderFab()
    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual(['Colar texto', 'Áudio (arquivo)', 'Gravar áudio'])
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
    const onSelectMode = vi.fn()
    const { unmount } = render(createElement(SecondBrainFab, { onSelectMode }))
    fireEvent.click(screen.getByLabelText('Ingerir conhecimento'))
    unmount()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })
})
