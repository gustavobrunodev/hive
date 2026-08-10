// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ScreenList } from './ScreenList'
import { EMPTY_SESSION, pushStep } from './screenSessions'
import type { ScreenSessions } from './screenSessions'

afterEach(() => {
  cleanup()
})

const SCREENS = [
  { screenId: 'login', title: 'Login', probe: 'screenHeading' as const },
  { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' as const }
]

const EDITED_LOGIN: ScreenSessions = { login: pushStep(EMPTY_SESSION, 'g1') }

function renderList(sessions: ScreenSessions = {}): ReturnType<typeof vi.fn> {
  const onSelect = vi.fn()
  render(
    createElement(ScreenList, {
      screens: SCREENS,
      activeScreenId: 'login',
      sessions,
      onSelect
    })
  )
  return onSelect
}

describe('ScreenList (T4.7, DS-R4)', () => {
  it('lists every Tela and marks the active one', () => {
    renderList()

    const rows = within(screen.getByLabelText('Telas desta Spec')).getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Logingerada automaticamente',
      'Cadastrogerada automaticamente'
    ])
    expect(rows[0].getAttribute('aria-current')).toBe('true')
    expect(rows[1].getAttribute('aria-current')).toBeNull()
  })

  it('switches Tela on click', () => {
    const onSelect = renderList()
    fireEvent.click(screen.getByText('Cadastro'))
    expect(onSelect).toHaveBeenCalledWith('cadastro')
  })

  /**
   * DS-R18: the distinction survives a forced palette and greyscale because it
   * is carried by the mark's fill and by an icon, not by a colour swap.
   */
  it('distinguishes an edited Tela by shape and icon, not by colour alone', () => {
    renderList(EDITED_LOGIN)

    const rows = within(screen.getByLabelText('Telas desta Spec')).getAllByRole('button')
    const [edited, auto] = rows

    expect(edited.querySelector('.wb-dstudio-screen-mark')?.getAttribute('data-edited')).toBe(
      'true'
    )
    expect(auto.querySelector('.wb-dstudio-screen-mark')?.getAttribute('data-edited')).toBeNull()
    expect(edited.querySelectorAll('svg')).toHaveLength(1)
    expect(auto.querySelectorAll('svg')).toHaveLength(0)
  })

  it('says the state in words, so it is not only a glyph', () => {
    renderList(EDITED_LOGIN)

    const rows = within(screen.getByLabelText('Telas desta Spec')).getAllByRole('button')
    expect(rows[0].textContent).toContain('editada nesta sessão')
    expect(rows[1].textContent).toContain('gerada automaticamente')
  })

  it('keeps a Tela marked as edited after its edits are undone (DS-R4 AC-3)', () => {
    // The mark says "you worked here", not "the document differs".
    const undone: ScreenSessions = { login: { steps: ['g1'], cursor: 0, transcript: [] } }
    renderList(undone)

    expect(screen.getAllByRole('button')[0].textContent).toContain('editada nesta sessão')
  })
})
