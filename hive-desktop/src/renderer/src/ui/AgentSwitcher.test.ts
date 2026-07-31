// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { AgentSwitcher } from './AgentSwitcher'

/**
 * P1-013 (multi-agent) — the composer's per-conversation agent control had no
 * test at all. Its one real rule is the lock: a conversation's `--resume`
 * handle is agent-specific, so switching agent after the first turn would
 * silently break the conversation's memory. "Locked" therefore has to be a
 * badge, not a disabled-looking control that still opens.
 */
const DropdownRadioContext = createContext<{ onValueChange?: (value: string) => void } | null>(null)

vi.mock('@hive/design-system', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
    createElement('button', { onClick: onSelect }, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuRadioGroup: ({
    children,
    onValueChange
  }: {
    children?: ReactNode
    onValueChange?: (value: string) => void
  }) => createElement(DropdownRadioContext.Provider, { value: { onValueChange } }, children),
  // `aria-label` is passed through deliberately: it is how each menu row is
  // addressable, and a stand-in that swallowed it would hide that from the test.
  DropdownMenuRadioItem: ({
    value,
    children,
    'aria-label': ariaLabel
  }: {
    value: string
    children?: ReactNode
    'aria-label'?: string
  }) => {
    const ctx = useContext(DropdownRadioContext)
    return createElement(
      'button',
      { onClick: () => ctx?.onValueChange?.(value), 'aria-label': ariaLabel },
      children
    )
  }
}))

const AGENTS = [
  { id: 'claude-cli', displayName: 'Claude Code' },
  { id: 'devin', displayName: 'Devin' }
]

afterEach(() => cleanup())

describe('AgentSwitcher (P1-013)', () => {
  it('renders nothing when the pool is empty', () => {
    const { container } = render(
      createElement(AgentSwitcher, {
        agents: [],
        value: null,
        locked: false,
        onChange: vi.fn(),
        onManage: vi.fn()
      })
    )
    expect(container.firstChild).toBeNull()
  })

  it('offers every enabled agent and reports the pick', () => {
    const onChange = vi.fn()
    render(
      createElement(AgentSwitcher, {
        agents: AGENTS,
        value: 'claude-cli',
        locked: false,
        onChange,
        onManage: vi.fn()
      })
    )

    expect(
      screen.getByLabelText('Agente da conversa: Claude Code. Clique para trocar.')
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Usar Devin nesta conversa'))
    expect(onChange).toHaveBeenCalledWith('devin')
  })

  it('locked, it is a badge — no way to switch and break the conversation memory', () => {
    const onChange = vi.fn()
    render(
      createElement(AgentSwitcher, {
        agents: AGENTS,
        value: 'devin',
        locked: true,
        onChange,
        onManage: vi.fn()
      })
    )

    expect(
      screen.getByLabelText(
        'Esta conversa está no agente Devin. Para usar outro, comece uma nova conversa.'
      )
    ).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByLabelText('Usar Claude Code nesta conversa')).toBeNull()
  })

  it('falls back to the first agent when the stored id is unknown', () => {
    // A conversation saved on an agent the user has since disabled must still
    // render something coherent instead of vanishing.
    render(
      createElement(AgentSwitcher, {
        agents: AGENTS,
        value: 'agente-que-sumiu',
        locked: false,
        onChange: vi.fn(),
        onManage: vi.fn()
      })
    )

    expect(
      screen.getByLabelText('Agente da conversa: Claude Code. Clique para trocar.')
    ).toBeTruthy()
  })

  it('routes "Gerenciar agentes" to the profile sheet', () => {
    const onManage = vi.fn()
    render(
      createElement(AgentSwitcher, {
        agents: AGENTS,
        value: 'claude-cli',
        locked: false,
        onChange: vi.fn(),
        onManage
      })
    )

    fireEvent.click(screen.getByText('Gerenciar agentes…'))
    expect(onManage).toHaveBeenCalledTimes(1)
  })
})
