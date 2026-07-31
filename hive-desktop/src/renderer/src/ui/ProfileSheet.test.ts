// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ProfileSheet } from './ProfileSheet'
import type { AgentMeta } from './AgentPicker'

/**
 * P1-010 (RP-R6 / AG-R3.2) — the profile sheet is where a *settled* user
 * changes role, agents and name, and every one of those writes through to
 * persisted config. Its functions sat at 44%: the name commit (blur/Enter,
 * with its "Salvo" feedback) and the agent toggle were untested, and both are
 * the kind of thing that fails silently — the user types a name, nothing
 * complains, nothing is saved.
 */
vi.mock('@hive/design-system', () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', null, children) : null,
  SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  SheetDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  Field: ({ label, children }: { label?: ReactNode; children?: ReactNode }) =>
    createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    'aria-label'?: string
  }) =>
    createElement('input', {
      type: 'checkbox',
      checked: Boolean(checked),
      onChange: (event: { target: { checked: boolean } }) =>
        onCheckedChange?.(event.target.checked),
      ...rest
    })
}))

const AGENT_METAS: AgentMeta[] = [
  {
    id: 'claude-cli',
    displayName: 'Claude Code',
    description: 'Agente da Anthropic.',
    available: true,
    installHint: 'instale claude',
    docsUrl: 'https://docs.example/claude'
  },
  {
    id: 'devin',
    displayName: 'Devin',
    description: 'Agente da Cognition.',
    available: true,
    installHint: 'instale devin',
    docsUrl: 'https://docs.example/devin'
  },
  {
    id: 'github-copilot',
    displayName: 'GitHub Copilot',
    description: 'CLI do Copilot.',
    available: false,
    installHint: 'instale a CLI do Copilot',
    docsUrl: 'https://docs.example/copilot'
  }
]

type Props = Parameters<typeof ProfileSheet>[0]

function renderSheet(over: Partial<Props> = {}): Props {
  const props: Props = {
    open: true,
    onOpenChange: vi.fn(),
    role: 'dev',
    agents: ['claude-cli'],
    defaultAgent: 'claude-cli',
    userName: 'Gustavo',
    onRoleChange: vi.fn(),
    onAgentsChange: vi.fn(),
    onDefaultAgentChange: vi.fn(),
    onUserNameChange: vi.fn(),
    ...over
  }
  render(createElement(ProfileSheet, props))
  return props
}

beforeEach(() => {
  window.hive = {
    ...window.hive,
    profile: { ...window.hive?.profile, agents: vi.fn(async () => AGENT_METAS) },
    openExternal: vi.fn()
  } as typeof window.hive
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ProfileSheet (P1-010)', () => {
  it('renders nothing while closed, and probes agents only once open', () => {
    const props = renderSheet({ open: false })
    expect(screen.queryByText('Perfil')).toBeNull()
    expect(props.onRoleChange).not.toHaveBeenCalled()
    expect(window.hive.profile.agents).not.toHaveBeenCalled()
  })

  it('re-probes availability on open, so a just-installed CLI shows up', async () => {
    renderSheet()
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())
    expect(window.hive.profile.agents).toHaveBeenCalledTimes(1)
  })

  it('changes the role from the sheet', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByRole('radio', { name: /Product Manager/ }))

    expect(props.onRoleChange).toHaveBeenCalledWith('pm')
  })

  it('commits the name on blur, shows "Salvo", and clears it after a beat', async () => {
    vi.useFakeTimers()
    try {
      const props = renderSheet()
      const input = screen.getByPlaceholderText('Seu nome')

      fireEvent.change(input, { target: { value: '  Ana  ' } })
      fireEvent.blur(input)

      // Trimmed on the way out — the greeting is a hello, not a form echo.
      expect(props.onUserNameChange).toHaveBeenCalledWith('Ana')
      const saved = screen.getByRole('status')
      expect(saved.getAttribute('data-visible')).toBe('true')

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByRole('status').getAttribute('data-visible')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('commits the name on Enter too', () => {
    const props = renderSheet()
    const input = screen.getByPlaceholderText('Seu nome')

    fireEvent.change(input, { target: { value: 'Ana' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(props.onUserNameChange).toHaveBeenCalledWith('Ana')
  })

  it('does not persist a name that did not change', () => {
    const props = renderSheet({ userName: 'Gustavo' })
    const input = screen.getByPlaceholderText('Seu nome')

    fireEvent.change(input, { target: { value: 'Gustavo ' } })
    fireEvent.blur(input)

    expect(props.onUserNameChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status').getAttribute('data-visible')).toBeNull()
  })

  it('enabling and disabling an agent rewrites the whole enabled set', async () => {
    const props = renderSheet({ agents: ['claude-cli'] })
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Devin'))
    expect(props.onAgentsChange).toHaveBeenLastCalledWith(['claude-cli', 'devin'])

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Claude Code'))
    expect(props.onAgentsChange).toHaveBeenLastCalledWith([])
  })

  it('promotes an agent to default from the sheet', async () => {
    const props = renderSheet({ agents: ['claude-cli', 'devin'] })
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Definir Devin como agente padrão'))

    expect(props.onDefaultAgentChange).toHaveBeenCalledWith('devin')
  })

  it('survives a host that wired no agent handlers at all', async () => {
    // Both agent callbacks are optional and default to no-ops. A host that
    // omits them (the sheet is also rendered from surfaces that only change
    // role/name) must not crash the moment someone flips a switch.
    render(
      createElement(ProfileSheet, {
        open: true,
        onOpenChange: vi.fn(),
        role: 'dev',
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        userName: null,
        onRoleChange: vi.fn(),
        onUserNameChange: vi.fn()
      })
    )
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Devin'))
    fireEvent.click(screen.getByLabelText('Definir Claude Code como agente padrão'))

    expect(screen.getByText('Devin')).toBeTruthy()
  })

  it('sends an uninstalled agent to its docs instead of offering a dead switch', async () => {
    renderSheet()
    await waitFor(() => expect(screen.getByText('GitHub Copilot')).toBeTruthy())

    expect(screen.queryByLabelText('Habilitar ou desabilitar GitHub Copilot')).toBeNull()
    fireEvent.click(screen.getByLabelText('Como instalar GitHub Copilot (abre no navegador)'))

    expect(window.hive.openExternal).toHaveBeenCalledWith('https://docs.example/copilot')
  })

  it('warns when the user has turned every agent off', async () => {
    renderSheet({ agents: [] })
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('Habilite ao menos um agente')
  })

  it('offers the tour replay only when the host wired one', async () => {
    const onReplayTour = vi.fn()
    renderSheet({ onReplayTour })
    fireEvent.click(screen.getByText('Rever o tour guiado'))
    expect(onReplayTour).toHaveBeenCalledTimes(1)

    cleanup()
    renderSheet({ onReplayTour: undefined })
    expect(screen.queryByText('Rever o tour guiado')).toBeNull()
  })

  it('drops a late probe answer after the sheet closes', async () => {
    let resolveAgents: (list: AgentMeta[]) => void = () => {}
    window.hive = {
      ...window.hive,
      profile: {
        ...window.hive?.profile,
        agents: vi.fn(() => new Promise<AgentMeta[]>((resolve) => (resolveAgents = resolve)))
      }
    } as typeof window.hive

    const { unmount } = render(
      createElement(ProfileSheet, {
        open: true,
        onOpenChange: vi.fn(),
        role: 'dev',
        agents: [],
        defaultAgent: null,
        userName: null,
        onRoleChange: vi.fn(),
        onUserNameChange: vi.fn()
      })
    )
    unmount()
    resolveAgents(AGENT_METAS)

    await waitFor(() => expect(document.body.textContent).toBe(''))
  })
})
