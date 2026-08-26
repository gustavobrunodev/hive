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
  // The delete confirmation (M26 bugfix) is a Dialog rendered inside this
  // sheet: a mock without it throws the moment the trash button is pressed.
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open === false ? null : createElement('div', { role: 'dialog' }, children),
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

const HARDWARE = {
  recommendedId: 'small' as const,
  reason: 'discreteGpu' as const,
  gpu: true,
  ramGB: 32,
  cores: 12
}

const PREFERENCE = {
  id: 'small' as const,
  auto: true,
  installed: ['tiny' as const, 'base' as const, 'small' as const],
  recommendation: HARDWARE
}

/** A fresh install: the app ships no weights, so this is where a new user starts. */
const NO_MODELS = { id: null, auto: true, installed: [], recommendation: HARDWARE }

const CATALOG = [
  whisperModelFixture({ id: 'tiny', params: '39 M', sizeMB: { fp32: 144, q8: 39 } }),
  whisperModelFixture({ id: 'base' }),
  whisperModelFixture({ id: 'small', params: '244 M', sizeMB: { fp32: 923, q8: 238 } }),
  whisperModelFixture({
    id: 'medium',
    params: '769 M',
    sizeMB: { fp32: 2916, q8: 740 },
    downloaded: false,
    downloadedVariant: null
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
        id === null
          ? PREFERENCE
          : { id, auto: false, installed: PREFERENCE.installed, recommendation: HARDWARE }
      ),
      // M26: downloads live in main. `onDownloads` is a read-only broadcast —
      // the test captures the listener and pushes snapshots through it, exactly
      // as main's manager does.
      onDownloads: vi.fn((listener: (list: unknown[]) => void) => {
        pushDownloads = (list) => act(() => listener(list))
        downloadUnsubscribes += 1
        return () => {
          downloadUnsubscribes -= 1
        }
      }),
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

/** Pushes a downloads snapshot from "main" into whatever is subscribed. */
let pushDownloads: (list: unknown[]) => void = () => {}
/** Everything listening for a download's ending. */
let settledListeners: ((record: unknown) => void)[] = []
/** Announces one download's ending, as main does when the bytes land. */
const pushSettled = (record: unknown): void =>
  act(() => {
    for (const listener of [...settledListeners]) listener(record)
  })
/** How many live `onDownloads` subscriptions exist — never a cancel signal. */
let downloadUnsubscribes = 0

/** One in-flight download record, as main broadcasts it. */
function downloading(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'medium',
    variant: 'fp32',
    status: 'downloading',
    loaded: 512 * 1024 * 1024,
    total: 3_057 * 1024 * 1024,
    file: 'onnx/encoder_model.onnx',
    bytesPerSecond: 2 * 1024 * 1024,
    failure: null,
    startedAt: 0,
    updatedAt: 0,
    ...over
  }
}

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
      expect(await screen.findByText('Seus modelos')).toBeTruthy()
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

    it('offers automatic first, then every model that is on disk', async () => {
      openVoice()
      await screen.findByText('Seus modelos')
      const radios = screen.getAllByRole('radio')
      // `medium` is not downloaded, so it is in the library below — not in the
      // list of things that could be chosen right now.
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
      await screen.findByText('Seus modelos')
      expect(screen.getByText('Recomendado')).toBeTruthy()
    })

    it('states what is transcribing right now, before offering any control', async () => {
      openVoice()
      expect(await screen.findByText('Em uso')).toBeTruthy()
      expect(screen.getByText('escolhido pelo Hive')).toBeTruthy()
    })

    it('explains a pinned choice differently from an automatic one', async () => {
      vi.mocked(window.hive.whisper.preference).mockResolvedValue({
        id: 'tiny',
        auto: false,
        installed: PREFERENCE.installed,
        recommendation: HARDWARE
      })
      openVoice()
      expect(await screen.findByText('fixado por você')).toBeTruthy()
      expect(screen.queryByText('escolhido pelo Hive')).toBeNull()
    })

    /**
     * M26 — the app ships no weights, so this is what a new user opens on. It
     * used to be unreachable: three models arrived inside the installer.
     */
    describe('with nothing downloaded', () => {
      function openEmpty(): void {
        vi.mocked(window.hive.whisper.preference).mockResolvedValue(NO_MODELS)
        vi.mocked(window.hive.whisper.listModels).mockResolvedValue(
          CATALOG.map((model) => ({ ...model, downloaded: false, downloadedVariant: null }))
        )
        openVoice()
      }

      it('leads with the model this machine should run, and its real size', async () => {
        openEmpty()
        expect(await screen.findByText('Nenhum modelo de voz ainda')).toBeTruthy()
        expect(screen.getByText('Recomendado para este computador')).toBeTruthy()
        // fp32, because this jsdom has no WebGPU adapter to ask.
        expect(screen.getByRole('button', { name: /Baixar · 923 MB/ })).toBeTruthy()
      })

      it('claims no model is in force, rather than naming one that is not there', async () => {
        openEmpty()
        await screen.findByText('Nenhum modelo de voz ainda')
        expect(screen.queryByText('Em uso')).toBeNull()
      })

      it('does not announce the empty state while the catalog is still in flight', () => {
        vi.mocked(window.hive.whisper.listModels).mockReturnValue(new Promise(() => {}))
        openVoice()
        expect(screen.queryByText('Nenhum modelo de voz ainda')).toBeNull()
        expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
      })
    })

    it('lists the downloadable models in the open, with no disclosure to find', async () => {
      openVoice()
      expect(await screen.findByLabelText('Baixar o modelo medium')).toBeTruthy()
      expect(screen.getByText('769 M · 2,8 GB')).toBeTruthy()
    })

    it('starts a download in main by id — never by opening a subscription', async () => {
      openVoice()
      fireEvent.click(await screen.findByLabelText('Baixar o modelo medium'))
      expect(window.hive.whisper.startDownload).toHaveBeenCalledWith('medium', 'fp32')
    })

    /**
     * The reading this surface exists to give. The bar it replaces moved once
     * per *file* — `medium` is two files and 2.8 GB, so it showed 0 %, then
     * 42 %, then done, over twenty minutes of apparent hang.
     */
    it('reports bytes, rate and remaining time, not just a percentage', async () => {
      openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      pushDownloads([downloading()])

      expect(screen.getByText('17%')).toBeTruthy()
      expect(screen.getByText('512 MB de 3,0 GB')).toBeTruthy()
      expect(screen.getByText('2,0 MB/s')).toBeTruthy()
      expect(screen.getByText(/cerca de 21 min restantes/)).toBeTruthy()
    })

    it('says "preparing" rather than 0% before the file index lands', async () => {
      openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      pushDownloads([downloading({ loaded: 0, total: 0, bytesPerSecond: 0 })])
      expect(screen.getByText('Preparando o download…')).toBeTruthy()
    })

    it('names the cause of a failure, and offers to continue from what arrived', async () => {
      openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      pushDownloads([
        downloading({
          status: 'error',
          failure: { kind: 'offline', detail: 'fetch failed' },
          loaded: 512 * 1024 * 1024
        })
      ])

      expect(screen.getByRole('alert').textContent).toContain('A conexão caiu')
      expect(screen.getByRole('alert').textContent).toContain('Os 512 MB já baixados continuam')
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
      expect(window.hive.whisper.startDownload).toHaveBeenCalledWith('medium', 'fp32')
    })

    it('offers no retry for a failure that will answer the same way next time', async () => {
      openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      pushDownloads([
        downloading({ status: 'error', failure: { kind: 'notFound', detail: 'HTTP 404' } })
      ])
      expect(screen.getByRole('alert').textContent).toContain('não está mais publicado')
      expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    })

    it('cancels by id in main, rather than by unsubscribing', async () => {
      openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      pushDownloads([downloading()])

      fireEvent.click(screen.getByLabelText('Cancelar o download de medium'))
      expect(window.hive.whisper.cancelDownload).toHaveBeenCalledWith('medium')
    })

    /**
     * The regression this whole redesign exists for: closing the sheet used to
     * send `whisper:download:stop`, killing a 2.8 GB transfer that was minutes
     * from finishing. Unsubscribing must now stop *watching* and nothing else.
     */
    it('leaves the download running when the sheet closes', async () => {
      const props = openVoice()
      await screen.findByLabelText('Baixar o modelo medium')
      fireEvent.click(screen.getByLabelText('Baixar o modelo medium'))

      cleanup()
      render(createElement(ProfileSheet, { ...props, open: false }))

      expect(window.hive.whisper.cancelDownload).not.toHaveBeenCalled()
      expect(downloadUnsubscribes).toBe(0)
    })

    /**
     * Deleting asks first. The undo for this button is a multi-gigabyte
     * download, which is the whole argument for a confirmation on a screen
     * that otherwise has none.
     */
    it('asks before deleting, and does nothing if the answer is no', async () => {
      openVoice()
      fireEvent.click(await screen.findByLabelText('Excluir o modelo small'))

      expect(screen.getByText('Excluir small?')).toBeTruthy()
      expect(screen.getByRole('dialog').textContent).toContain('923 MB')
      fireEvent.click(screen.getByRole('button', { name: 'Manter' }))
      expect(window.hive.whisper.deleteModel).not.toHaveBeenCalled()
    })

    it('deletes a downloaded model and re-reads BOTH the catalog and the choice', async () => {
      openVoice()
      fireEvent.click(await screen.findByLabelText('Excluir o modelo small'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      await waitFor(() => expect(window.hive.whisper.deleteModel).toHaveBeenCalledWith('small'))
      // Deleting the model that was in force hands the choice back to the probe
      // IN MAIN, without the user picking anything — a renderer that only read
      // the preference on mount would keep showing a model that is gone.
      await waitFor(() =>
        expect(vi.mocked(window.hive.whisper.preference).mock.calls.length).toBeGreaterThan(1)
      )
    })

    /**
     * A `remove` that throws part-way (Windows will not unlink a weight file
     * the engine still has open) used to leave the screen frozen on a model
     * that was already half gone: the refresh hung off `.then`.
     */
    it('re-reads the catalog even when the delete itself failed', async () => {
      vi.mocked(window.hive.whisper.deleteModel).mockRejectedValueOnce(new Error('EBUSY'))
      const before = vi.mocked(window.hive.whisper.listModels).mock.calls.length
      openVoice()
      fireEvent.click(await screen.findByLabelText('Excluir o modelo small'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

      await waitFor(() =>
        expect(vi.mocked(window.hive.whisper.listModels).mock.calls.length).toBeGreaterThan(
          before + 1
        )
      )
      expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível excluir')
    })

    /**
     * The bug a user reported verbatim: `medium` finished downloading and the
     * row kept its "Baixar" button until the app was closed and reopened. The
     * transfer belongs to main, so the only thing that reaches this screen is
     * the ending — and nothing was listening for it.
     */
    it('moves a model into "Seus modelos" the moment its download lands', async () => {
      openVoice()
      expect(await screen.findByLabelText('Baixar o modelo medium')).toBeTruthy()

      vi.mocked(window.hive.whisper.listModels).mockResolvedValue(
        CATALOG.map((model) =>
          model.id === 'medium'
            ? { ...model, downloaded: true, downloadedVariant: 'fp32' as const }
            : model
        )
      )
      pushSettled({ id: 'medium', status: 'done' })

      await waitFor(() => expect(screen.queryByLabelText('Baixar o modelo medium')).toBeNull())
      expect(screen.getByLabelText('Usar o modelo medium')).toBeTruthy()
    })

    it('says so when there is genuinely nothing left to download', async () => {
      vi.mocked(window.hive.whisper.listModels).mockResolvedValue(CATALOG.slice(0, 3))
      openVoice()
      expect(await screen.findByText(/você já tem todos os modelos/i)).toBeTruthy()
    })

    it('does not announce "nothing to download" while the catalog is in flight', () => {
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
