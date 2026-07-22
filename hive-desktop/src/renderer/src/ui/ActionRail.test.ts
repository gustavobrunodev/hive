// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActionRail } from './ActionRail'

/**
 * `ActionRail` — the persistent left tool rail. Task T12 (npm-distribution,
 * design.md §5 Tier 1) added the ambient `updatePending` dot on the gear;
 * this is the component's first dedicated test file (previously only
 * exercised indirectly through `WorkUI.test.ts`), so it also covers the
 * rail's pre-existing click wiring.
 */

function baseProps(): {
  onOpenSearch: ReturnType<typeof vi.fn>
  onOpenStudio: ReturnType<typeof vi.fn>
  onOpenMcp: ReturnType<typeof vi.fn>
  onOpenAppSettings: ReturnType<typeof vi.fn>
} {
  return {
    onOpenSearch: vi.fn(),
    onOpenStudio: vi.fn(),
    onOpenMcp: vi.fn(),
    onOpenAppSettings: vi.fn()
  }
}

afterEach(() => {
  cleanup()
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
