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
  // The picker's install affordances (agent-onboarding) render inside this sheet.
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  },
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
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
    version: '2.1.226 (Claude Code)',
    detectCommand: 'claude',
    installHint: 'instale claude',
    installable: true,
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    docsUrl: 'https://docs.example/claude'
  },
  {
    id: 'devin',
    displayName: 'Devin',
    description: 'Agente da Cognition.',
    available: true,
    version: null,
    detectCommand: 'devin',
    installHint: 'instale devin',
    installable: false,
    installCommand: null,
    docsUrl: 'https://docs.example/devin'
  },
  {
    id: 'github-copilot',
    displayName: 'GitHub Copilot',
    description: 'CLI do Copilot.',
    available: false,
    version: null,
    detectCommand: 'copilot',
    installHint: 'instale a CLI do Copilot',
    installable: true,
    installCommand: 'npm install -g @github/copilot',
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
    shortcutCounts: { start: 5, during: 1 },
    onOpenShortcuts: vi.fn(),
    onAgentsChange: vi.fn(),
    onDefaultAgentChange: vi.fn(),
    onUserNameChange: vi.fn(),
    ...over
  }
  render(createElement(ProfileSheet, props))
  return props
}

/** Set per test that drives an install; receives the picker's event callback. */
let emitInstall: (event: unknown) => void = () => {}

beforeEach(() => {
  emitInstall = () => {}
  window.hive = {
    ...window.hive,
    profile: {
      ...window.hive?.profile,
      agents: vi.fn(async () => AGENT_METAS),
      installAgent: vi.fn((_id: string, onEvent: (event: unknown) => void) => {
        emitInstall = onEvent
        return vi.fn()
      })
    },
    openExternal: vi.fn()
  } as typeof window.hive
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ProfileSheet (P1-010)', () => {
  it('renders nothing while closed, and probes agents only once open', () => {
    renderSheet({ open: false })
    expect(screen.queryByText('Perfil')).toBeNull()
    expect(window.hive.profile.agents).not.toHaveBeenCalled()
  })

  it('re-probes availability on open, so a just-installed CLI shows up', async () => {
    renderSheet()
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())
    expect(window.hive.profile.agents).toHaveBeenCalledTimes(1)
  })

  // shortcut-scopes: the role is chosen once, at first access. The sheet
  // states it and explains where it came from — it never re-offers the choice.
  it('shows the active role as read-only context, with no way to change it', () => {
    renderSheet({ role: 'pm' })

    expect(screen.getByText('Product Manager')).toBeTruthy()
    expect(screen.getByText(/Escolhido no primeiro acesso/)).toBeTruthy()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByText('Tech Lead')).toBeNull()
  })

  it('falls back to the general descriptor when no role is set yet', () => {
    renderSheet({ role: null })
    expect(screen.getByText('Geral')).toBeTruthy()
  })

  // The profile is the always-reachable way into the picker, from either set.
  it('summarizes both shortcut sets and opens the picker', () => {
    const props = renderSheet({ shortcutCounts: { start: 5, during: 0 } })

    expect(screen.getByText('Para iniciar')).toBeTruthy()
    expect(screen.getByText('5 atalhos')).toBeTruthy()
    expect(screen.getByText('Durante a conversa')).toBeTruthy()
    // An empty set reads as a legitimate state, not a zero.
    expect(screen.getByText('Nenhum')).toBeTruthy()

    fireEvent.click(screen.getByText('Configurar atalhos'))
    expect(props.onOpenShortcuts).toHaveBeenCalledWith('start')
  })

  it('renders one shortcut in the singular and hides the CTA when unwired', () => {
    renderSheet({ shortcutCounts: { start: 1, during: 1 } })
    expect(screen.getAllByText('1 atalho')).toHaveLength(2)

    cleanup()
    renderSheet({ onOpenShortcuts: undefined })
    expect(screen.queryByText('Configurar atalhos')).toBeNull()
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

  // agent-onboarding AO-R6: the sheet is the *second* home of the picker, and
  // both of its new powers have to work here too — a settled user is exactly
  // who installs a second agent.
  it('re-scans on demand without closing the sheet', async () => {
    renderSheet()
    await waitFor(() => expect(screen.getByText('GitHub Copilot')).toBeTruthy())

    fireEvent.click(screen.getByText('Procurar de novo'))

    await waitFor(() => expect(window.hive.profile.agents).toHaveBeenLastCalledWith(true))
    expect(screen.getByText('Perfil')).toBeTruthy()
  })

  it('installing an agent from the sheet enables it', async () => {
    const props = renderSheet()
    await waitFor(() => expect(screen.getByText('GitHub Copilot')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Instalar GitHub Copilot agora'))
    act(() =>
      emitInstall({
        type: 'done',
        agent: { ...AGENT_METAS[2], available: true, version: '1.4.0' }
      })
    )

    // Installing it is the consent to use it — the card flipping to
    // "available" while staying switched off would read as a half-install.
    expect(props.onAgentsChange).toHaveBeenCalledWith(['claude-cli', 'github-copilot'])
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
        onUserNameChange: vi.fn()
      })
    )
    unmount()
    resolveAgents(AGENT_METAS)

    await waitFor(() => expect(document.body.textContent).toBe(''))
  })
})
