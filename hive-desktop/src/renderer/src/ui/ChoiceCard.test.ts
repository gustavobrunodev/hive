// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ChoiceGrid, type ChoiceOption } from './ChoiceCard'

/**
 * P1-011 / P2-017 — `ChoiceGrid` is the one "pick one" vocabulary in the app
 * (agent picker, role picker, both profile-sheet sections), and it implements
 * the ARIA radiogroup keyboard pattern by hand: a single tab stop (roving
 * tabindex), arrows that wrap, Home/End, Enter/Space, disabled options skipped.
 * All of that lived at 64% — i.e. the keyboard path, the part a mouse test can
 * never reach, was the uncovered part.
 */
function option(id: string, over: Partial<ChoiceOption> = {}): ChoiceOption {
  return {
    id,
    icon: null,
    title: `título ${id}`,
    description: `descrição ${id}`,
    ...over
  }
}

function renderGrid(
  options: ChoiceOption[],
  value: string | null = null
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn()
  render(createElement(ChoiceGrid, { ariaLabel: 'escolha', options, value, onChange }))
  return { onChange }
}

/** The radio for `id`, by its title. */
function card(id: string): HTMLElement {
  return screen.getByRole('radio', { name: new RegExp(`título ${id}`) })
}

afterEach(() => cleanup())

describe('ChoiceGrid (P1-011/P2-017)', () => {
  it('exposes one tab stop: the first enabled option before any pick', () => {
    renderGrid([option('a'), option('b'), option('c')])

    expect(card('a').tabIndex).toBe(0)
    expect(card('b').tabIndex).toBe(-1)
    expect(card('c').tabIndex).toBe(-1)
  })

  it('moves the tab stop onto the selection once there is one', () => {
    renderGrid([option('a'), option('b')], 'b')

    expect(card('a').tabIndex).toBe(-1)
    expect(card('b').tabIndex).toBe(0)
    expect(card('b').getAttribute('aria-checked')).toBe('true')
  })

  it('arrow keys select the neighbour and wrap in both directions', () => {
    const { onChange } = renderGrid([option('a'), option('b'), option('c')], 'a')

    fireEvent.keyDown(card('a'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith('b')
    fireEvent.keyDown(card('a'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('b')
    // Backwards from the first wraps to the last, not to nothing.
    fireEvent.keyDown(card('a'), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(card('a'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('c')
  })

  it('Home and End jump to the ends', () => {
    const { onChange } = renderGrid([option('a'), option('b'), option('c')], 'b')

    fireEvent.keyDown(card('b'), { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('a')
    fireEvent.keyDown(card('b'), { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('c')
  })

  it('Enter and Space pick the focused option', () => {
    const { onChange } = renderGrid([option('a'), option('b')])

    fireEvent.keyDown(card('b'), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('b')
    fireEvent.keyDown(card('a'), { key: ' ' })
    expect(onChange).toHaveBeenLastCalledWith('a')
  })

  it('ignores keys it does not own, so nothing is swallowed', () => {
    const { onChange } = renderGrid([option('a'), option('b')])

    fireEvent.keyDown(card('a'), { key: 'Tab' })
    fireEvent.keyDown(card('a'), { key: 'x' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('skips disabled options in keyboard travel and refuses their click', () => {
    const { onChange } = renderGrid(
      [option('a'), option('b', { disabled: true, badge: 'Em breve' }), option('c')],
      'a'
    )

    expect(card('b').tabIndex).toBe(-1)
    expect(card('b').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Em breve')).toBeTruthy()

    // Arrow travel goes a → c, stepping over the disabled card entirely.
    fireEvent.keyDown(card('a'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith('c')

    fireEvent.click(card('b'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('keeps a tab stop when the selected option is disabled', () => {
    // A selection that has since been disabled must not strand the group with
    // no reachable tab stop.
    renderGrid([option('a', { disabled: true }), option('b')], 'a')

    expect(card('b').tabIndex).toBe(0)
  })

  it('a click selects, and the extra slot renders under the description', () => {
    const { onChange } = renderGrid([
      option('a', { extra: createElement('span', null, 'preview extra') })
    ])

    expect(screen.getByText('preview extra')).toBeTruthy()
    fireEvent.click(card('a'))
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('an all-disabled grid has no tab stop and no keyboard movement', () => {
    const { onChange } = renderGrid([
      option('a', { disabled: true }),
      option('b', { disabled: true })
    ])

    expect(card('a').tabIndex).toBe(-1)
    expect(card('b').tabIndex).toBe(-1)
    fireEvent.keyDown(card('a'), { key: 'ArrowDown' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
