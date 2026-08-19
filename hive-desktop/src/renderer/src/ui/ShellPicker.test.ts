// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShellPicker, type ShellCatalogView, type ShellOption } from './ShellPicker'

/**
 * agent-terminal (AT-R1/AT-R5). The picker's job is not "show a list" — it is
 * to let someone choose a terminal *and understand what the choice does*.
 *
 * That second half is what failed in production and is what most of these
 * tests are about. A user picked "Prompt de Comando", read a paragraph that
 * said the CLI "usa o Git Bash ou o PowerShell que encontrar", and then heard
 * from the agent that it was using PowerShell. Every claim on this surface now
 * names a shell, and the tests below are the ones that would have caught it:
 * the destination is on screen, it is marked when it isn't what was picked,
 * and it changes with the selection.
 */

const RadioContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

function RadioConsumer({
  value,
  ...rest
}: { value: string } & Record<string, unknown>): React.JSX.Element {
  const group = useContext(RadioContext)
  return createElement('input', {
    type: 'radio',
    value,
    checked: group.value === value,
    onChange: () => group.onValueChange?.(value),
    ...rest
  })
}

vi.mock('@hive/design-system', () => ({
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
      { role: 'radiogroup', ...rest },
      createElement(RadioContext.Provider, { value: { value, onValueChange } }, children)
    ),
  RadioGroupItem: ({ value, ...rest }: { value: string }) =>
    createElement(RadioConsumer, { value, ...rest }),
  // A structural stand-in for the DS card: the header labels the radio, and
  // the detail region renders only while selected — the two behaviours the
  // picker's own logic depends on.
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
        createElement(RadioConsumer, { value, 'aria-label': String(title) }),
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
      onCopy && createElement('button', { onClick: () => onCopy(command) }, 'Copiar')
    ),
  Badge: ({ children }: { children?: ReactNode }) => createElement('span', null, children)
}))

const claudeOn = (
  support: 'native' | 'fallback' | 'launch-only',
  runsIn: string | null,
  note?: string
): ShellOption['agents'][number] =>
  ({
    agentId: 'claude-cli',
    displayName: 'Claude CLI',
    support,
    runsIn,
    note
  }) as ShellOption['agents'][number]

const cmd: ShellOption = {
  id: 'cmd',
  path: 'C:\\Windows\\System32\\cmd.exe',
  family: 'cmd',
  automatic: false,
  preview: 'C:\\Windows\\System32\\cmd.exe /d /s /c "claude -p …"',
  agents: [claudeOn('fallback', 'git-bash', 'cmd-no-executor')]
}

const gitBash: ShellOption = {
  id: 'git-bash',
  path: 'C:\\Program Files\\Git\\bin\\bash.exe',
  family: 'bash',
  automatic: true,
  preview: `C:\\Program Files\\Git\\bin\\bash.exe -c exec 'claude' '-p' '…'`,
  agents: [claudeOn('native', 'git-bash', 'windows-git-bash')]
}

const view: ShellCatalogView = {
  shells: [cmd, gitBash],
  selectedId: null,
  resolvedId: 'git-bash',
  missingSelection: false,
  platform: 'win32'
}

function renderPicker(over: Partial<Parameters<typeof ShellPicker>[0]> = {}): {
  onSelect: ReturnType<typeof vi.fn>
  onRefresh: ReturnType<typeof vi.fn>
  onCopy: ReturnType<typeof vi.fn>
  onOpenUrl: ReturnType<typeof vi.fn>
} {
  const onSelect = vi.fn()
  const onRefresh = vi.fn()
  const onCopy = vi.fn()
  const onOpenUrl = vi.fn()
  render(
    createElement(ShellPicker, {
      view,
      onSelect,
      onRefresh,
      onCopy,
      onOpenUrl,
      refreshing: false,
      ...over
    })
  )
  return { onSelect, onRefresh, onCopy, onOpenUrl }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ShellPicker', () => {
  it('shows the absolute path detection found, as the row’s evidence', () => {
    renderPicker()
    expect(screen.getByText('C:\\Windows\\System32\\cmd.exe')).toBeTruthy()
    expect(screen.getByText('C:\\Program Files\\Git\\bin\\bash.exe')).toBeTruthy()
  })

  it('names what "Automático" resolves to instead of leaving the user to guess', () => {
    renderPicker()
    expect(screen.getByText(/O Hive escolhe o melhor para os agentes: Git Bash/)).toBeTruthy()
  })

  /**
   * Caught in the visual pass. "Automático" describes its own rule, so it has
   * to read the shell that rule lands on — not `resolvedId`, which under a
   * manual pick is the pick. Reading the wrong one made the row announce the
   * shell the user had just chosen *by hand* as "o padrão do sistema".
   */
  it('keeps describing its own rule after another shell is picked by hand', () => {
    renderPicker({ view: { ...view, selectedId: 'cmd', resolvedId: 'cmd' } })
    expect(screen.getByText(/O Hive escolhe o melhor para os agentes: Git Bash/)).toBeTruthy()
    expect(screen.queryByText(/para os agentes: Prompt de Comando/)).toBeNull()
  })

  it('says "segue o sistema" on POSIX, where the machine default is also the good one', () => {
    renderPicker({ view: { ...view, platform: 'darwin' } })
    expect(screen.getByText(/Segue o terminal do sistema: Git Bash/)).toBeTruthy()
  })

  it('badges the shell the next turn runs in, even when another row is selected', () => {
    // "Automático" is the selection; Git Bash is where the turn lands. Both
    // facts on screen at once is the point — one is the rule, one is the
    // outcome, and hiding the outcome is what made the old picker misleading.
    renderPicker()
    expect(screen.getAllByText('Em uso')).toHaveLength(1)
  })

  /** The bug, as a test: the destination is named, not implied. */
  it('names the shell each agent really executes in', () => {
    renderPicker({ view: { ...view, selectedId: 'cmd' } })
    const routes = document.querySelectorAll('.wb-shell-route')
    expect(routes).toHaveLength(1)
    expect(routes[0].textContent).toContain('Claude CLI')
    expect(routes[0].textContent).toContain('Git Bash')
    expect(routes[0].getAttribute('data-support')).toBe('fallback')
  })

  it('explains a re-route without repeating the destination line', () => {
    renderPicker({ view: { ...view, selectedId: 'cmd' } })
    expect(
      screen.getByText(/não executa comandos no Prompt de Comando.*fixa o Git Bash/)
    ).toBeTruthy()
  })

  it('drops the note entirely when the route already says everything', () => {
    renderPicker({ view: { ...view, selectedId: 'git-bash' } })
    expect(document.querySelector('.wb-shell-route')?.getAttribute('data-support')).toBe('native')
    expect(document.querySelectorAll('.wb-shell-note')).toHaveLength(0)
  })

  it('swaps the outcome when another shell is selected — the one that is true now', () => {
    renderPicker({ view: { ...view, selectedId: 'git-bash' } })
    expect(screen.queryByText(/não executa comandos no Prompt de Comando/)).toBeNull()
  })

  it('offers the way out when the fallback only landed on PowerShell for lack of Git Bash', () => {
    const { onOpenUrl } = renderPicker({
      view: {
        ...view,
        selectedId: 'cmd',
        shells: [
          { ...cmd, agents: [claudeOn('fallback', 'powershell', 'install-git-bash')] },
          gitBash
        ]
      }
    })
    fireEvent.click(screen.getByText('Instalar o Git para Windows'))
    expect(onOpenUrl).toHaveBeenCalledWith('https://git-scm.com/downloads/win')
  })

  /**
   * The receipt. It is collapsed by default because most readers want the
   * answer, not the proof — but it has to be reachable, and it has to be the
   * real argv, which is why the fixture carries `shellSpawnTarget`'s output.
   */
  it('keeps the command line one click away, and copies through the host', () => {
    const { onCopy } = renderPicker({ view: { ...view, selectedId: 'git-bash' } })
    expect(screen.queryByText(gitBash.preview)).toBeNull()

    fireEvent.click(screen.getByText('Ver o comando'))
    expect(screen.getByText(gitBash.preview)).toBeTruthy()

    fireEvent.click(screen.getByText('Copiar'))
    expect(onCopy).toHaveBeenCalledWith(gitBash.preview)
  })

  it('persists a pick, and maps "Automático" back to null', () => {
    const { onSelect } = renderPicker()
    fireEvent.click(screen.getByLabelText('Git Bash'))
    expect(onSelect).toHaveBeenCalledWith('git-bash')

    cleanup()
    const second = renderPicker({ view: { ...view, selectedId: 'git-bash' } })
    fireEvent.click(screen.getByLabelText('Automático'))
    expect(second.onSelect).toHaveBeenCalledWith(null)
  })

  it('re-detects on demand, and says so while it runs', () => {
    const { onRefresh } = renderPicker()
    fireEvent.click(screen.getByText('Procurar terminais'))
    expect(onRefresh).toHaveBeenCalledTimes(1)

    cleanup()
    renderPicker({ refreshing: true })
    expect(screen.getByText('Procurando terminais…')).toBeTruthy()
  })

  it('reports a choice whose shell is gone, without dropping the choice', () => {
    renderPicker({
      view: {
        shells: [cmd],
        selectedId: 'git-bash',
        resolvedId: 'cmd',
        missingSelection: true,
        platform: 'win32'
      }
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Git Bash')
    expect(alert.textContent).toContain('a escolha volta sozinha')
  })

  it('teaches rather than accuses when no shell was detected at all', () => {
    renderPicker({
      view: {
        shells: [],
        selectedId: null,
        resolvedId: null,
        missingSelection: false,
        platform: 'linux'
      }
    })
    expect(screen.getByText(/Nenhum terminal reconhecido/)).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('renders nothing catastrophic before the catalog arrives', () => {
    renderPicker({ view: null })
    expect(screen.getByText('0 terminais encontrados')).toBeTruthy()
  })

  it('falls back to the binary name for a shell this build does not know', () => {
    renderPicker({
      view: {
        shells: [{ ...cmd, id: 'ksh', path: '/bin/ksh', family: 'sh', agents: [] }],
        selectedId: 'ksh',
        resolvedId: 'ksh',
        missingSelection: false,
        platform: 'linux'
      }
    })
    expect(screen.getByLabelText('Ksh')).toBeTruthy()
  })
})
