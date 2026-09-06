// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActionRail, SIDEBAR_REGION_ID } from './ActionRail'

/**
 * `ActionRail` — the persistent left tool rail. Task T12 (npm-distribution,
 * design.md §5 Tier 1) added the ambient `updatePending` dot on the gear;
 * this is the component's first dedicated test file (previously only
 * exercised indirectly through `WorkUI.test.ts`), so it also covers the
 * rail's pre-existing click wiring.
 */

function baseProps(): {
  activeView: 'explorer' | 'scm' | 'review' | 'brain'
  onSelectView: ReturnType<typeof vi.fn>
  onOpenSearch: ReturnType<typeof vi.fn>
  onOpenStudio: ReturnType<typeof vi.fn>
  onOpenMcp: ReturnType<typeof vi.fn>
  onOpenAppSettings: ReturnType<typeof vi.fn>
} {
  return {
    activeView: 'explorer',
    onSelectView: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenStudio: vi.fn(),
    onOpenMcp: vi.fn(),
    onOpenAppSettings: vi.fn()
  }
}

afterEach(() => {
  cleanup()
})

describe('ActionRail — view switcher (git-management GIT-R13)', () => {
  it('renders Explorer + Source Control view entries with the showing one pressed', () => {
    render(createElement(ActionRail, { ...baseProps(), activeView: 'scm' }))
    expect(screen.getByLabelText('Explorador').getAttribute('aria-pressed')).toBe('false')
    // The entry on screen names what a click does now — it hides the panel.
    expect(screen.getByLabelText('Ocultar Controle de versão').getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  it('selecting a view calls onSelectView with its id', () => {
    const props = baseProps()
    render(createElement(ActionRail, props))
    fireEvent.click(screen.getByLabelText('Controle de versão'))
    expect(props.onSelectView).toHaveBeenCalledWith('scm')
    // `activeView` is 'explorer' here, so its entry is the one on screen.
    fireEvent.click(screen.getByLabelText('Ocultar Explorador'))
    expect(props.onSelectView).toHaveBeenCalledWith('explorer')
  })

  it('shows a change-count badge + accessible count on Source Control, hidden at zero', () => {
    const { container, rerender } = render(createElement(ActionRail, baseProps()))
    expect(container.querySelector('.wb-rail-badge')).toBeNull()

    rerender(createElement(ActionRail, { ...baseProps(), changeCount: 5 }))
    expect(container.querySelector('.wb-rail-badge')?.textContent).toBe('5')
    expect(screen.getByLabelText(/5 alterações pendentes/)).toBeTruthy()

    rerender(createElement(ActionRail, { ...baseProps(), changeCount: 120 }))
    expect(container.querySelector('.wb-rail-badge')?.textContent).toBe('99+')
  })

  // Agent Change Review (M11, T11): the third "Revisão do agente" view entry.
  it('renders the Revisão entry, selects it, and shows its pending badge', () => {
    const props = baseProps()
    const { rerender } = render(createElement(ActionRail, { ...props, activeView: 'review' }))
    const entry = screen.getByLabelText('Ocultar Revisão do agente')
    expect(entry.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(entry)
    expect(props.onSelectView).toHaveBeenCalledWith('review')

    // The badge + accessible count appear only when reviewCount > 0.
    rerender(createElement(ActionRail, { ...props, reviewCount: 3 }))
    expect(screen.getByLabelText(/3 mudanças pendentes/)).toBeTruthy()

    // Caps the badge at 99+.
    rerender(createElement(ActionRail, { ...props, reviewCount: 120 }))
    const badges = Array.from(document.querySelectorAll('.wb-rail-badge')).map((b) => b.textContent)
    expect(badges).toContain('99+')
  })

  // Second Brain (M12, T6): the fourth "Second Brain" view entry + raw-pending badge.
  it('renders the Second Brain entry, selects it, and shows its raw-pending badge with Ctrl+Shift+B', () => {
    const props = baseProps()
    const { rerender } = render(createElement(ActionRail, { ...props, activeView: 'brain' }))
    const entry = screen.getByLabelText('Ocultar Bases de conhecimento')
    expect(entry.getAttribute('aria-pressed')).toBe('true')
    expect(entry.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+B')

    fireEvent.click(entry)
    expect(props.onSelectView).toHaveBeenCalledWith('brain')

    // No badge at zero; appears with an accessible count once > 0.
    expect(screen.getByLabelText('Ocultar Bases de conhecimento').textContent).toBe('')
    rerender(createElement(ActionRail, { ...props, activeView: 'brain', rawPendingCount: 2 }))
    expect(screen.getByLabelText(/2 itens para ingerir/)).toBeTruthy()
    rerender(createElement(ActionRail, { ...props, activeView: 'brain', rawPendingCount: 1 }))
    expect(screen.getByLabelText(/1 item para ingerir/)).toBeTruthy()
  })

  it('tolerates omitting onSelectView (defaults to a no-op)', () => {
    render(
      createElement(ActionRail, {
        onOpenSearch: vi.fn(),
        onOpenStudio: vi.fn(),
        onOpenMcp: vi.fn(),
        onOpenAppSettings: vi.fn()
      })
    )
    // Clicking a view with no handler must not throw (the default no-op runs).
    expect(() => fireEvent.click(screen.getByLabelText('Controle de versão'))).not.toThrow()
  })
})

describe('ActionRail — existing click wiring', () => {
  it('fires each callback for its own button', () => {
    const props = baseProps()
    render(createElement(ActionRail, props))

    // The four buttons carry no visible text (icon-only) — select by title/aria-label instead.
    fireEvent.click(screen.getByTitle(/Ctrl\+P/))
    expect(props.onOpenSearch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Estúdio de skills'))
    expect(props.onOpenStudio).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Servidores MCP'))
    expect(props.onOpenMcp).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Configurações do aplicativo'))
    expect(props.onOpenAppSettings).toHaveBeenCalledTimes(1)
  })
})

describe('ActionRail — ambient update dot (T12, ND-R5.5)', () => {
  it('shows no dot and the plain aria-label when updatePending is omitted/false', () => {
    const { container } = render(createElement(ActionRail, baseProps()))
    expect(container.querySelector('.wb-rail-update-dot')).toBeNull()
    expect(screen.getByLabelText('Configurações do aplicativo')).toBeTruthy()
  })

  it('paints the dot and extends the aria-label when a version is pending (available/downloading/downloaded/error)', () => {
    const { container } = render(createElement(ActionRail, { ...baseProps(), updatePending: true }))
    const dot = container.querySelector('.wb-rail-update-dot')
    expect(dot).not.toBeNull()
    // Non-color-only cue (ND-R6.5): the gear's accessible name grows an
    // addition rather than relying on the dot's color/position alone.
    expect(
      screen.getByLabelText('Configurações do aplicativo — Atualização disponível')
    ).toBeTruthy()
  })

  it('clicking the gear while the dot is showing still opens app settings', () => {
    const props = { ...baseProps(), updatePending: true }
    render(createElement(ActionRail, props))
    fireEvent.click(screen.getByLabelText('Configurações do aplicativo — Atualização disponível'))
    expect(props.onOpenAppSettings).toHaveBeenCalledTimes(1)
  })
})

/**
 * workspace-session — the sidebar the rail drives can be hidden, so "selected"
 * and "on screen" stopped being one fact. These cover the second one.
 */
describe('ActionRail — hideable sidebar (workspace-session)', () => {
  it('with the sidebar hidden, nothing reads as showing and the selected view rests', () => {
    render(createElement(ActionRail, { ...baseProps(), activeView: 'scm', sidebarOpen: false }))
    const entry = screen.getByLabelText('Controle de versão')
    // Not pressed, not expanded: nothing is on screen to be pressed about.
    expect(entry.getAttribute('aria-pressed')).toBe('false')
    expect(entry.getAttribute('aria-expanded')).toBe('false')
    expect(entry.hasAttribute('data-active')).toBe(false)
    // ...but it is still the view a reopen lands on, and says so.
    expect(entry.hasAttribute('data-resting')).toBe(true)
    expect(screen.getByLabelText('Explorador').hasAttribute('data-resting')).toBe(false)
  })

  it('names the panel it controls, so the state is a promise about something', () => {
    render(createElement(ActionRail, baseProps()))
    const entry = screen.getByLabelText('Ocultar Explorador')
    expect(entry.getAttribute('aria-expanded')).toBe('true')
    expect(entry.getAttribute('aria-controls')).toBe(SIDEBAR_REGION_ID)
  })

  it('reports the click either way — the workbench owns the open/closed decision', () => {
    const props = { ...baseProps(), sidebarOpen: false }
    render(createElement(ActionRail, props))
    fireEvent.click(screen.getByLabelText('Explorador'))
    expect(props.onSelectView).toHaveBeenCalledWith('explorer')
  })

  it('keeps the badge count in the accessible name while the panel is hidden', () => {
    render(
      createElement(ActionRail, {
        ...baseProps(),
        activeView: 'scm',
        sidebarOpen: false,
        changeCount: 4
      })
    )
    expect(screen.getByLabelText('Controle de versão — 4 alterações pendentes')).toBeTruthy()
  })

  it('anchors the tour at the Explorer entry — the button that opens the panel', () => {
    const { container } = render(createElement(ActionRail, { ...baseProps(), sidebarOpen: false }))
    const anchor = container.querySelector('[data-tour="files"]')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('aria-label')).toBe('Explorador')
    expect(anchor?.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+E')
  })
})
