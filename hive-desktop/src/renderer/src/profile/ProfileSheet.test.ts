// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ProfileSheet } from './ProfileSheet'
import type { AgentMeta } from '../ui/AgentPicker'
import { asrReadinessFixture, createHiveAsrMock } from '../testSupport/hiveAsrMock'

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
  // agent-terminal: the terminal picker renders inside this sheet. Radix's
  // radio group is replaced by a plain radio input so the mocked tree still
  // reports checked state and fires a change.
  RadioGroup: ({
    children,
    value,
    onValueChange,
    ...rest
  }: {
    children?: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) =>
    createElement(
      'div',
      { role: 'radiogroup', 'data-value': value, ...rest },
      createElement(ShellRadioContext.Provider, { value: { value, onValueChange } }, children)
    ),
  // The whole row lives INSIDE the control (that is the point of the real
  // component — a Radix radio is a `<button>`, which `<label htmlFor>` cannot
  // name). The mock mirrors that: an input plus its children inside one label,
  // so `getByRole('radio', { name })` resolves to the row's text.
  RadioGroupItem: ({ value, children, ...rest }: { value: string; children?: ReactNode }) =>
    createElement('label', null, createElement(ShellRadioConsumer, { value, ...rest }), children),
  // The card's header labels the radio; the detail region renders only while
  // the card is selected. Both are behaviours the picker's logic leans on.
  RadioCard: ({
    value,
    title,
    meta,
    badge,
    leading,
    selected,
    children
  }: {
    value: string
    title?: ReactNode
    meta?: ReactNode
    badge?: ReactNode
    leading?: ReactNode
    selected?: boolean
    children?: ReactNode
  }) =>
    createElement(
      'div',
      null,
      createElement(
        'label',
        null,
        createElement(ShellRadioConsumer, { value, 'aria-label': String(title) }),
        leading,
        createElement('span', null, title),
        badge,
        meta && createElement('span', null, meta)
      ),
      selected ? children : null
    ),
  // The delete confirmation (M26 bugfix) is a Dialog rendered inside this
  // sheet: a mock without it throws the moment the trash button is pressed.
  // `onOpenChange(false)` is the Dialog's own dismiss — the overlay and Escape,
  // the paths a user reaches for without reading the buttons. The mock exposes
  // it as a control so that path is testable at all.
  Dialog: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open === false
      ? null
      : createElement(
          'div',
          { role: 'dialog' },
          createElement(
            'button',
            { type: 'button', 'data-testid': 'dialog-dismiss', onClick: () => onOpenChange?.(false) },
            'dismiss'
          ),
          children
        ),
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  CommandLine: ({ command, onCopy }: { command: string; onCopy?: (text: string) => void }) =>
    createElement(
      'div',
      null,
      createElement('code', null, command),
      onCopy ? createElement('button', { onClick: () => onCopy(command) }, 'Copiar') : null
    ),
  Badge: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
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

/** Shared state for the mocked radio group above (Radix's context, in miniature). */
const ShellRadioContext = createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

function ShellRadioConsumer({
  value,
  ...rest
}: { value: string } & Record<string, unknown>): React.JSX.Element {
  const group = useContext(ShellRadioContext)
  return createElement('input', {
    type: 'radio',
    value,
    checked: group.value === value,
    onChange: () => group.onValueChange?.(value),
    ...rest
  })
}

const SHELL_VIEW = {
  shells: [
    {
      id: 'cmd',
      path: 'C:\\Windows\\System32\\cmd.exe',
      family: 'cmd' as const,
      automatic: false,
      preview: 'C:\\Windows\\System32\\cmd.exe /d /s /c "claude -p …"',
      agents: [
        {
          agentId: 'claude-cli',
          displayName: 'Claude Code',
          support: 'fallback' as const,
          note: 'cmd-no-executor' as const,
          runsIn: 'git-bash'
        }
      ]
    },
    {
      id: 'git-bash',
      path: 'C:\\Program Files\\Git\\bin\\bash.exe',
      family: 'bash' as const,
      automatic: true,
      preview: `C:\\Program Files\\Git\\bin\\bash.exe -c exec 'claude' '-p' '…'`,
      agents: [
        {
          agentId: 'claude-cli',
          displayName: 'Claude Code',
          support: 'native' as const,
          note: 'windows-git-bash' as const,
          runsIn: 'git-bash'
        }
      ]
    }
  ],
  selectedId: null,
  resolvedId: 'git-bash',
  missingSelection: false,
  platform: 'win32' as const
}

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

/** A fresh install: the app ships no weights, so this is where a new user starts. */
const NOT_INSTALLED = asrReadinessFixture({ installed: false })
const INSTALLED = asrReadinessFixture({
  installed: true,
  runtime: { threads: 4, facts: { gpu: true, ramGB: 16, cores: 8 } }
})

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
  settledListeners = []
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
    shell: {
      list: vi.fn(async () => SHELL_VIEW),
      select: vi.fn(async () => undefined)
    },
    openExternal: vi.fn(),
    clipboard: { writeText: vi.fn(async () => undefined) },
    // voice-settings (M25): the index row states whether transcription is
    // ready, so the bridge answers for every render of this sheet — not only
    // inside the detail.
    asr: {
      ...createHiveAsrMock(),
      readiness: vi.fn(async () => INSTALLED),
      deleteModel: vi.fn(async () => NOT_INSTALLED),
      // M26: downloads live in main. `onDownloads` is a read-only broadcast,
      // and unsubscribing from it must never stop a transfer.
      onDownloads: vi.fn(() => () => {}),
      // The ending is its own channel: a finished download LEAVES the snapshot,
      // so a screen watching only `onDownloads` sees it vanish and cannot tell
      // "arrived" from "cancelled". Every listener is kept, as main broadcasts
      // to every window.
      onDownloadSettled: vi.fn((listener: (record: unknown) => void) => {
        settledListeners.push(listener)
        return () => {
          const at = settledListeners.indexOf(listener)
          if (at >= 0) settledListeners.splice(at, 1)
        }
      })
    }
  } as typeof window.hive
})

/** Everything listening for a download's ending. */
let settledListeners: ((record: unknown) => void)[] = []

/** Opens one scope from the index — every detail is one click deep now. */
function goTo(scope: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name: scope }))
}

const BACK = 'Voltar para a lista de configurações'

/** The download stream's callback, as the preload bridge types it. */

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
    // Probed on open, not on entering the scope: the index row states how many
    // are enabled, so the answer is needed before anyone drills in.
    await waitFor(() => expect(window.hive.profile.agents).toHaveBeenCalledTimes(1))
    goTo(/Agentes/)
    expect(await screen.findByText('Devin')).toBeTruthy()
  })

  // shortcut-scopes: the role is chosen once, at first access. The sheet
  // states it and explains where it came from — it never re-offers the choice.
  it('shows the active role as read-only context, with no way to change it', () => {
    renderSheet({ role: 'pm' })
    // The index already names it; the detail explains where it came from.
    expect(screen.getByText('Product Manager')).toBeTruthy()

    goTo(/Conta/)
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
    goTo(/Atalhos/)

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
    goTo(/Atalhos/)
    expect(screen.getAllByText('1 atalho')).toHaveLength(2)

    cleanup()
    renderSheet({ onOpenShortcuts: undefined })
    goTo(/Atalhos/)
    expect(screen.queryByText('Configurar atalhos')).toBeNull()
  })

  it('commits the name on blur, shows "Salvo", and clears it after a beat', async () => {
    vi.useFakeTimers()
    try {
      const props = renderSheet()
      goTo(/Conta/)
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
    goTo(/Conta/)
    const input = screen.getByPlaceholderText('Seu nome')

    fireEvent.change(input, { target: { value: 'Ana' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(props.onUserNameChange).toHaveBeenCalledWith('Ana')
  })

  it('does not persist a name that did not change', () => {
    const props = renderSheet({ userName: 'Gustavo' })
    goTo(/Conta/)
    const input = screen.getByPlaceholderText('Seu nome')

    fireEvent.change(input, { target: { value: 'Gustavo ' } })
    fireEvent.blur(input)

    expect(props.onUserNameChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status').getAttribute('data-visible')).toBeNull()
  })

  it('enabling and disabling an agent rewrites the whole enabled set', async () => {
    const props = renderSheet({ agents: ['claude-cli'] })
    goTo(/Agentes/)
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Devin'))
    expect(props.onAgentsChange).toHaveBeenLastCalledWith(['claude-cli', 'devin'])

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Claude Code'))
    expect(props.onAgentsChange).toHaveBeenLastCalledWith([])
  })

  it('promotes an agent to default from the sheet', async () => {
    const props = renderSheet({ agents: ['claude-cli', 'devin'] })
    goTo(/Agentes/)
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
    goTo(/Agentes/)
    await waitFor(() => expect(screen.getByText('Devin')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar Devin'))
    fireEvent.click(screen.getByLabelText('Definir Claude Code como agente padrão'))

    expect(screen.getByText('Devin')).toBeTruthy()
  })

  it('sends an uninstalled agent to its docs instead of offering a dead switch', async () => {
    renderSheet()
    goTo(/Agentes/)
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
    goTo(/Agentes/)
    await waitFor(() => expect(screen.getByText('GitHub Copilot')).toBeTruthy())

    fireEvent.click(screen.getByText('Procurar de novo'))

    await waitFor(() => expect(window.hive.profile.agents).toHaveBeenLastCalledWith(true))
    // Still inside the scope: a re-scan must not bounce the reader out.
    expect(screen.getByText('Agentes')).toBeTruthy()
  })

  it('installing an agent from the sheet enables it', async () => {
    const props = renderSheet()
    goTo(/Agentes/)
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
    goTo(/Agentes/)
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

  // agent-terminal: the section's whole job is that a pick reaches disk and
  // the sheet then shows what the new pick implies.
  it('persists a terminal pick and re-reads the catalog so the caveats follow it', async () => {
    renderSheet()
    goTo(/Terminal/)
    await waitFor(() => expect(screen.getByLabelText('Git Bash')).toBeTruthy())

    const select = window.hive.shell.select as ReturnType<typeof vi.fn>
    const list = window.hive.shell.list as ReturnType<typeof vi.fn>
    fireEvent.click(screen.getByLabelText('Git Bash'))

    await waitFor(() => expect(select).toHaveBeenCalledWith('git-bash'))
    // Re-read after the write: the per-agent caveat under the selected row is
    // derived from the catalog, so a stale view would keep showing the old
    // shell's consequences.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })

  /**
   * The two escapes from the terminal section, and the reason they are props
   * rather than calls inside the picker: both go through the main process.
   * `navigator.clipboard` is denied in this renderer (the defect the file
   * explorer already paid for once), and a link has to open in the user's
   * browser, not inside the app window.
   */
  it('copies the command line through the host clipboard, never the renderer’s', async () => {
    renderSheet()
    goTo(/Terminal/)
    await waitFor(() => expect(screen.getByLabelText('Git Bash')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Git Bash'))
    await waitFor(() => expect(screen.getByText('Ver o comando')).toBeTruthy())
    fireEvent.click(screen.getByText('Ver o comando'))
    fireEvent.click(screen.getByText('Copiar'))

    expect(window.hive.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('bash.exe')
    )
  })

  it('sends the "instale o Git" way out to the browser', async () => {
    const list = window.hive.shell.list as ReturnType<typeof vi.fn>
    list.mockResolvedValue({
      ...SHELL_VIEW,
      selectedId: 'cmd',
      shells: [
        {
          ...SHELL_VIEW.shells[0],
          agents: [
            {
              agentId: 'claude-cli',
              displayName: 'Claude Code',
              support: 'fallback' as const,
              note: 'install-git-bash' as const,
              runsIn: 'powershell'
            }
          ]
        }
      ]
    })
    renderSheet()
    goTo(/Terminal/)
    await waitFor(() => expect(screen.getByText('Instalar o Git para Windows')).toBeTruthy())

    fireEvent.click(screen.getByText('Instalar o Git para Windows'))

    expect(window.hive.openExternal).toHaveBeenCalledWith('https://git-scm.com/downloads/win')
  })

  it('re-detects terminals without closing the sheet', async () => {
    renderSheet()
    goTo(/Terminal/)
    await waitFor(() => expect(screen.getByText('Procurar terminais')).toBeTruthy())

    fireEvent.click(screen.getByText('Procurar terminais'))
    await waitFor(() => expect(window.hive.shell.list).toHaveBeenCalledWith(true))
  })

  /**
   * voice-settings (M25) — the index. The flat sheet made the reader scroll
   * 1771 px to find out how the app was set up; these rows answer that without
   * a click, which is the only reason a list of links is worth reading.
   */
  describe('the index', () => {
    it('states the live setup on every row, before anyone drills in', async () => {
      renderSheet({
        userName: 'Gustavo',
        agents: ['claude-cli'],
        shortcutCounts: { start: 5, during: 1 }
      })

      expect(screen.getByRole('button', { name: /Conta.*Gustavo/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Agentes.*1 habilitado/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Atalhos.*6 atalhos/ })).toBeTruthy()
      // Both of these arrive over IPC, so they land after the first paint.
      expect(
        await screen.findByRole('button', { name: /Voz e transcrição.*Pronto para transcrever/ })
      ).toBeTruthy()
      expect(await screen.findByRole('button', { name: /Terminal.*Git Bash/ })).toBeTruthy()
    })

    it('shows a skeleton, never a guess, while a value is still in flight', () => {
      // `null` means "not asked yet", not "none" — printing "Nenhum modelo"
      // here and swapping it a tick later changes a fact under the reader.
      vi.mocked(window.hive.asr.readiness).mockReturnValue(new Promise(() => {}))
      renderSheet()
      expect(screen.getByRole('button', { name: /Voz e transcrição/ }).textContent).toBe(
        'Voz e transcrição'
      )
    })

    it('names the automatic terminal rather than just calling it automatic', async () => {
      // "Automático" is the only value on this list that does not name itself.
      renderSheet()
      expect(await screen.findByText('Automático · Git Bash')).toBeTruthy()
    })

    it('falls back to a dash for a name that was never set', () => {
      renderSheet({ userName: null })
      expect(screen.getByRole('button', { name: /Conta.*—/ })).toBeTruthy()
    })
  })

  describe('drilling in and back out', () => {
    it('shows one scope at a time, and comes back to the index', () => {
      renderSheet()
      goTo(/Atalhos/)
      expect(screen.getByText('Para iniciar')).toBeTruthy()
      // The other scopes are gone, not merely scrolled off.
      expect(screen.queryByRole('button', { name: /Terminal.*Git Bash/ })).toBeNull()

      fireEvent.click(screen.getByLabelText(BACK))
      expect(screen.getByText('Perfil')).toBeTruthy()
      expect(screen.queryByText('Para iniciar')).toBeNull()
    })

    it('re-opening lands on the index, never two levels deep', () => {
      const props = renderSheet()
      goTo(/Atalhos/)
      expect(screen.getByText('Para iniciar')).toBeTruthy()

      cleanup()
      render(createElement(ProfileSheet, { ...props, open: false }))
      cleanup()
      render(createElement(ProfileSheet, { ...props, open: true }))
      expect(screen.getByText('Perfil')).toBeTruthy()
    })

    it('opens straight on a scope when something deep-linked into it', async () => {
      // The ingestion sheet's "Alterar" points here; landing on the index with
      // the reader left to find the row would waste the click they just spent.
      renderSheet({ initialScope: 'voice' })
      expect(await screen.findByText('Parakeet TDT v3')).toBeTruthy()
    })

    it('hides the tour entry when the host wired none, and keeps it off details', () => {
      renderSheet({ onReplayTour: vi.fn() })
      expect(screen.getByText('Rever o tour guiado')).toBeTruthy()
      goTo(/Conta/)
      expect(screen.queryByText('Rever o tour guiado')).toBeNull()
    })
  })

  /**
   * Voz e transcrição — the scope this restructuring existed to make room for.
   * It is a **global** setting: the same engine drives dictation in the chat
   * and the Second Brain's audio ingestion.
   *
   * Most of what this block used to assert is gone with the catalog it was
   * about: pinning a model, returning to "Automático", the ladder's reasons,
   * the fit warnings, the "you have every model" empty state. One model leaves
   * a state, a size and one action.
   */
  describe('voice & transcription', () => {
    function openVoice(over: Partial<Props> = {}): Props {
      const props = renderSheet(over)
      goTo(/Voz e transcrição/)
      return props
    }

    it('reports what the probe measured, including what it decided', async () => {
      openVoice()
      expect(await screen.findByText('16 GB')).toBeTruthy()
      expect(screen.getByText('8')).toBeTruthy()
      // The reading that now has a consequence: how many cores the engine takes.
      expect(screen.getByText('Núcleos em uso')).toBeTruthy()
      expect(screen.getByText('4')).toBeTruthy()
    })

    it('no longer reports the GPU, which decides nothing now', async () => {
      openVoice()
      await screen.findByText('16 GB')
      // It used to gate which model could run at all — inference was
      // WebGPU-or-one-WASM-thread. Native CPU inference makes it a fact with no
      // consequence, and those are noise on a settings screen.
      expect(screen.queryByText('Placa de vídeo')).toBeNull()
    })

    it('states the model is here, and offers only to remove it', async () => {
      openVoice()
      expect(await screen.findByText('Baixado')).toBeTruthy()
      expect(screen.getByText('Excluir do computador')).toBeTruthy()
      expect(screen.queryByText(/Baixar ·/)).toBeNull()
    })

    it('names the size and the reach before asking for the download', async () => {
      vi.mocked(window.hive.asr.readiness).mockResolvedValue(NOT_INSTALLED)
      openVoice()
      expect(await screen.findByText('Baixar · 671 MB')).toBeTruthy()
      expect(screen.getByText('600 M de parâmetros · 25 idiomas · 671 MB')).toBeTruthy()
    })

    it('offers no chooser at all — there is nothing to choose', async () => {
      openVoice()
      await screen.findByText('Baixado')
      expect(screen.queryByRole('radio')).toBeNull()
    })

    it('starts the download in main', async () => {
      vi.mocked(window.hive.asr.readiness).mockResolvedValue(NOT_INSTALLED)
      openVoice()
      fireEvent.click(await screen.findByText('Baixar · 671 MB'))
      expect(window.hive.asr.startDownload).toHaveBeenCalledTimes(1)
    })

    /**
     * The regression the M26 redesign existed for: the hook this replaced held
     * the download's only handle and its unmount cleanup **sent the stop**, so
     * closing the sheet killed a transfer minutes from finishing.
     */
    it('closing the sheet never cancels a download', async () => {
      const props = openVoice()
      await screen.findByText('Baixado')
      cleanup()
      render(createElement(ProfileSheet, { ...props, open: false }))
      expect(window.hive.asr.cancelDownload).not.toHaveBeenCalled()
    })

    it('re-reads readiness when a download completes elsewhere', async () => {
      openVoice()
      await screen.findByText('Baixado')
      const before = vi.mocked(window.hive.asr.readiness).mock.calls.length
      act(() => {
        for (const listener of settledListeners) {
          listener({ id: 'parakeet-tdt-0.6b-v3-int8', status: 'done' })
        }
      })
      // A model that landed while the sheet was open used to keep its "Baixar"
      // button until the app was restarted — a user reported exactly that.
      await waitFor(() =>
        expect(vi.mocked(window.hive.asr.readiness).mock.calls.length).toBeGreaterThan(before)
      )
    })

    it('asks before deleting, because the undo is a download', async () => {
      openVoice()
      fireEvent.click(await screen.findByText('Excluir do computador'))
      expect(screen.getByText('Excluir o modelo de voz?')).toBeTruthy()
      expect(window.hive.asr.deleteModel).not.toHaveBeenCalled()

      fireEvent.click(screen.getByText('Manter'))
      expect(window.hive.asr.deleteModel).not.toHaveBeenCalled()
    })

    it('deletes on confirmation, and the screen follows', async () => {
      openVoice()
      fireEvent.click(await screen.findByText('Excluir do computador'))
      fireEvent.click(screen.getByText('Excluir'))
      await waitFor(() => expect(window.hive.asr.deleteModel).toHaveBeenCalledTimes(1))
      // Main answers with the readiness that resulted rather than the caller
      // guessing what it became.
      expect(await screen.findByText('Baixar · 671 MB')).toBeTruthy()
    })

    it('says nothing while main is still answering', () => {
      vi.mocked(window.hive.asr.readiness).mockReturnValue(new Promise(() => {}))
      openVoice()
      expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
      expect(screen.queryByText(/Baixar ·/)).toBeNull()
    })

    /**
     * Windows refuses to unlink a weight file the engine still has open. Main
     * evicts the session before removing the files, but the delete can still
     * fail — and a confirmation that closed over a model still on disk, with
     * nothing on screen saying so, is the worst of the two outcomes.
     */
    it('says so when the delete fails, instead of closing over a stale screen', async () => {
      vi.mocked(window.hive.asr.deleteModel).mockRejectedValue(new Error('EBUSY'))
      openVoice()
      fireEvent.click(await screen.findByText('Excluir do computador'))
      fireEvent.click(screen.getByText('Excluir'))
      expect(await screen.findByRole('alert')).toBeTruthy()
      // Still installed, because it still is.
      expect(screen.getByText('Baixado')).toBeTruthy()
    })

    it('closes the confirmation on a dismiss, without deleting anything', async () => {
      openVoice()
      fireEvent.click(await screen.findByText('Excluir do computador'))
      // The Dialog's own dismiss (overlay/Escape), not the "Manter" button —
      // a different path to the same answer, and the one a user reaches for
      // without reading.
      fireEvent.click(screen.getByTestId('dialog-dismiss'))
      expect(screen.queryByText('Excluir o modelo de voz?')).toBeNull()
      expect(window.hive.asr.deleteModel).not.toHaveBeenCalled()
    })

    it('reports "measuring" rather than zeroes when the probe read nothing', async () => {
      vi.mocked(window.hive.asr.readiness).mockResolvedValue(
        asrReadinessFixture({ installed: true })
      )
      openVoice()
      // The fixture's runtime is the unknown machine: `ramGB: 0` is "we did not
      // measure", and printing "0 GB" would state something false.
      expect(await screen.findAllByText('—')).toBeTruthy()
    })
  })

  it('falls back to the general descriptor when no role and no name are set', () => {
    // Both null is the state a user is in before the install form runs — the
    // sheet has to render it rather than assume onboarding already happened.
    renderSheet({ role: null, userName: null })
    goTo(/Conta/)
    expect(screen.getByText('Geral')).toBeTruthy()
    expect((screen.getByPlaceholderText('Seu nome') as HTMLInputElement).value).toBe('')
  })

  it('re-syncs the name field when the lifted value moves under it', () => {
    const props = renderSheet({ userName: 'Gustavo' })
    goTo(/Conta/)
    cleanup()
    render(createElement(ProfileSheet, { ...props, userName: 'Ana' }))
    goTo(/Conta/)
    expect((screen.getByPlaceholderText('Seu nome') as HTMLInputElement).value).toBe('Ana')
  })

  it('drops a late probe answer after the sheet closes', async () => {
    let resolveAgents: (list: AgentMeta[]) => void = () => {}
    window.hive = {
      ...window.hive,
      profile: {
        ...window.hive?.profile,
        agents: vi.fn(() => new Promise<AgentMeta[]>((resolve) => (resolveAgents = resolve)))
      },
      shell: {
        list: vi.fn(async () => SHELL_VIEW),
        select: vi.fn(async () => undefined)
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
