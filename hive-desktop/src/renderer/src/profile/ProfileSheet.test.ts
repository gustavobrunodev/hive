// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ProfileSheet } from './ProfileSheet'
import type { AgentMeta } from '../ui/AgentPicker'
import { createHiveWhisperMock, whisperModelFixture } from '../testSupport/hiveWhisperMock'

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

const HARDWARE = {
  recommendedId: 'small' as const,
  reason: 'discreteGpu' as const,
  gpu: true,
  ramGB: 32,
  cores: 12
}

const PREFERENCE = { id: 'small' as const, auto: true, recommendation: HARDWARE }

const CATALOG = [
  whisperModelFixture({ id: 'tiny', params: '39 M', sizeMB: { fp32: 144, q8: 39 } }),
  whisperModelFixture({ id: 'base' }),
  whisperModelFixture({ id: 'small', params: '244 M', sizeMB: { fp32: 923, q8: 238 } }),
  whisperModelFixture({
    id: 'medium',
    params: '769 M',
    sizeMB: { fp32: 2916, q8: 740 },
    downloaded: false,
    downloadedVariant: null,
    bundled: false
  })
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
    shell: {
      list: vi.fn(async () => SHELL_VIEW),
      select: vi.fn(async () => undefined)
    },
    openExternal: vi.fn(),
    clipboard: { writeText: vi.fn(async () => undefined) },
    // voice-settings (M25): the index row states the model, so the bridge
    // answers for every render of this sheet — not only inside the detail.
    whisper: {
      ...createHiveWhisperMock(),
      listModels: vi.fn(async () => CATALOG),
      preference: vi.fn(async () => PREFERENCE),
      // Echoes the newly-resolved preference, as main does. A stub that always
      // returned the same answer would leave the group's checked row frozen,
      // and jsdom fires no `change` on a radio that is already checked — so a
      // second selection would silently assert nothing.
      setPreferredModel: vi.fn(async (id: string | null) =>
        id === null ? PREFERENCE : { id, auto: false, recommendation: HARDWARE }
      )
    }
  } as typeof window.hive
})

/** Opens one scope from the index — every detail is one click deep now. */
function goTo(scope: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name: scope }))
}

const BACK = 'Voltar para a lista de configurações'

/** The download stream's callback, as the preload bridge types it. */
type DownloadEvent = Parameters<Window['hive']['whisper']['downloadModel']>[2]

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
      expect(await screen.findByRole('button', { name: /Voz e transcrição.*small/ })).toBeTruthy()
      expect(await screen.findByRole('button', { name: /Terminal.*Git Bash/ })).toBeTruthy()
    })

    it('shows a skeleton, never a guess, while a value is still in flight', () => {
      // `null` means "not asked yet", not "none" — printing `base` here and
      // swapping it for `small` a tick later changes a fact under the reader.
      vi.mocked(window.hive.whisper.preference).mockReturnValue(new Promise(() => {}))
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
      expect(await screen.findByText('Modelo de transcrição')).toBeTruthy()
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
   * It is a **global** setting: the same answer drives dictation in the chat
   * and the Second Brain's audio ingestion.
   */
  describe('voice & transcription', () => {
    function openVoice(over: Partial<Props> = {}): Props {
      const props = renderSheet(over)
      goTo(/Voz e transcrição/)
      return props
    }

    it('reports what the probe measured, so "Automático" is a statement', async () => {
      openVoice()
      expect(await screen.findByText('Dedicada')).toBeTruthy()
      expect(screen.getByText('32 GB')).toBeTruthy()
      expect(screen.getByText('12')).toBeTruthy()
      // The verdict is NOT restated here: the chooser's automatic row and its
      // caption already name the model, and three copies of one fact was the
      // defect the visual pass found.
      expect(screen.queryByText(/Melhor escolha/)).toBeNull()
    })

    it('offers automatic first, then the models that ship in the app', async () => {
      openVoice()
      await screen.findByText('Modelo de transcrição')
      const radios = screen.getAllByRole('radio')
      expect(radios[0].getAttribute('value')).toBe('auto')
      // `medium` is a download, so it is not in the inline chooser.
      expect(radios.map((r) => r.getAttribute('value'))).toEqual(['auto', 'tiny', 'base', 'small'])
    })

    it('pins a model, and hands the choice back with Automático', async () => {
      openVoice()
      fireEvent.click(await screen.findByRole('radio', { name: /tiny/ }))
      await waitFor(() =>
        expect(window.hive.whisper.setPreferredModel).toHaveBeenCalledWith('tiny')
      )

      fireEvent.click(screen.getByRole('radio', { name: /Automático/ }))
      await waitFor(() => expect(window.hive.whisper.setPreferredModel).toHaveBeenCalledWith(null))
    })

    it("marks the probe's pick so the automatic answer is visible in the list", async () => {
      openVoice()
      await screen.findByText('Modelo de transcrição')
      expect(screen.getByText('Recomendado')).toBeTruthy()
    })

    it('explains a pinned choice differently from an automatic one', async () => {
      vi.mocked(window.hive.whisper.preference).mockResolvedValue({
        id: 'tiny',
        auto: false,
        recommendation: HARDWARE
      })
      openVoice()
      expect(await screen.findByText('Você fixou tiny.')).toBeTruthy()
      expect(screen.queryByText(/O Hive está usando/)).toBeNull()
    })

    it('still offers a row for a pinned model that does not ship in the app', async () => {
      // Otherwise the group would report no checked option at all — the reader
      // would see their own choice as unselected.
      vi.mocked(window.hive.whisper.preference).mockResolvedValue({
        id: 'medium',
        auto: false,
        recommendation: HARDWARE
      })
      openVoice()
      expect(await screen.findByRole('radio', { name: /medium/ })).toBeTruthy()
    })

    it('keeps the downloads collapsed, then lists them with their real size', async () => {
      openVoice()
      const toggle = await screen.findByLabelText('Mostrar os modelos que precisam de download')
      expect(toggle.textContent).toContain('Mais 1 modelo para baixar')
      expect(screen.queryByLabelText('Baixar o modelo medium')).toBeNull()

      fireEvent.click(toggle)
      expect(screen.getByLabelText('Baixar o modelo medium')).toBeTruthy()
      // fp32, because this jsdom has no WebGPU adapter to ask.
      expect(screen.getByText('769 M · 2.8 GB')).toBeTruthy()
    })

    it('reports download progress and re-reads the catalog when it lands', async () => {
      let emit: DownloadEvent = () => {}
      vi.mocked(window.hive.whisper.downloadModel).mockImplementation((_id, _variant, onEvent) => {
        emit = onEvent
        return () => {}
      })
      openVoice()
      fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
      fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))

      act(() => emit({ type: 'progress', id: 'medium', loaded: 50, total: 200, file: 'x.onnx' }))
      expect(screen.getByText('25%')).toBeTruthy()

      const before = vi.mocked(window.hive.whisper.listModels).mock.calls.length
      act(() => emit({ type: 'done', id: 'medium' }))
      await waitFor(() =>
        expect(vi.mocked(window.hive.whisper.listModels).mock.calls.length).toBeGreaterThan(before)
      )
    })

    it('keeps a failed download visible instead of silently reverting', async () => {
      // A row that went back to "Baixar" after a network drop is
      // indistinguishable from one that was never clicked.
      let emit: DownloadEvent = () => {}
      vi.mocked(window.hive.whisper.downloadModel).mockImplementation((_id, _variant, onEvent) => {
        emit = onEvent
        return () => {}
      })
      openVoice()
      fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
      fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))
      act(() => emit({ type: 'error', id: 'medium', message: 'ECONNRESET' }))

      expect(screen.getByRole('alert').textContent).toContain('O download falhou')
      fireEvent.click(screen.getByText('Tentar de novo'))
      expect(vi.mocked(window.hive.whisper.downloadModel).mock.calls.length).toBe(2)
    })

    it('cancelling unsubscribes, which is what actually stops the stream', async () => {
      const off = vi.fn()
      vi.mocked(window.hive.whisper.downloadModel).mockReturnValue(off)
      openVoice()
      fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
      fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))
      fireEvent.click(screen.getByLabelText('Cancelar o download de medium'))

      expect(off).toHaveBeenCalled()
      expect(screen.getByLabelText('Baixar o modelo medium')).toBeTruthy()
    })

    it('deletes a downloaded model and re-reads BOTH the catalog and the choice', async () => {
      vi.mocked(window.hive.whisper.listModels).mockResolvedValue([
        ...CATALOG.slice(0, 3),
        whisperModelFixture({ id: 'medium', bundled: false, downloaded: true })
      ])
      openVoice()
      fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
      fireEvent.click(screen.getByLabelText('Excluir o modelo medium'))

      await waitFor(() => expect(window.hive.whisper.deleteModel).toHaveBeenCalledWith('medium'))
      // Deleting the model that was in force hands the choice back to the probe
      // IN MAIN, without the user picking anything — a renderer that only read
      // the preference on mount would keep showing a model that is gone.
      await waitFor(() =>
        expect(vi.mocked(window.hive.whisper.preference).mock.calls.length).toBeGreaterThan(1)
      )
    })

    it('says so when there is genuinely nothing left to download', async () => {
      vi.mocked(window.hive.whisper.listModels).mockResolvedValue(CATALOG.slice(0, 3))
      openVoice()
      expect(await screen.findByText(/você já tem todos os modelos/i)).toBeTruthy()
    })

    it('does not announce "nothing to download" while the catalog is in flight', () => {
      // The app always ships three models, so an empty list means "not asked
      // yet". Reading the length alone printed a confident, wrong sentence for
      // the length of one IPC round trip.
      vi.mocked(window.hive.whisper.listModels).mockReturnValue(new Promise(() => {}))
      openVoice()
      expect(screen.queryByText(/você já tem todos os modelos/i)).toBeNull()
      expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
    })

    it('states nothing at all until main has answered', () => {
      vi.mocked(window.hive.whisper.preference).mockReturnValue(new Promise(() => {}))
      openVoice()
      expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
      expect(screen.queryByRole('radio')).toBeNull()
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

  it('reports 0% rather than NaN for a download whose total is not known yet', async () => {
    // The stream's first events can carry `total: 0`; dividing by it renders
    // "NaN%" in a progress bar, which reads as a crash rather than a wait.
    let emit: DownloadEvent = () => {}
    vi.mocked(window.hive.whisper.downloadModel).mockImplementation((_id, _variant, onEvent) => {
      emit = onEvent
      return () => {}
    })
    renderSheet()
    goTo(/Voz e transcrição/)
    fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
    fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))

    act(() => emit({ type: 'progress', id: 'medium', loaded: 0, total: 0, file: 'x.onnx' }))
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('releases every live download stream when the sheet unmounts', async () => {
    // No `whisper:download:cancel` exists — unsubscribing IS the cancel, so a
    // handle left behind keeps a stream running in main after the sheet is gone.
    const off = vi.fn()
    vi.mocked(window.hive.whisper.downloadModel).mockReturnValue(off)
    const props = renderSheet()
    goTo(/Voz e transcrição/)
    fireEvent.click(await screen.findByLabelText('Mostrar os modelos que precisam de download'))
    fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))

    cleanup()
    render(createElement(ProfileSheet, { ...props, open: false }))
    expect(off).toHaveBeenCalled()
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
