// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShellPicker, type ShellCatalogView } from './ShellPicker'

/**
 * agent-terminal (AT-R1/AT-R5). The picker's job is not "show a list" — it is
 * to let someone choose a terminal *and understand what the choice does*, so
 * the tests below are about the two claims on screen: the path is the one
 * detection found, and the per-agent caveat belongs to the row that is
 * actually selected. The Windows default (`cmd`, where Claude cannot execute
 * at all) is the case that would silently become a lie.
 */

const RadioContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

function RadioConsumer({ value, ...rest }: { value: string }): React.JSX.Element {
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
    createElement(RadioConsumer, { value, ...rest })
}))

const cmd = {
  id: 'cmd',
  path: 'C:\\Windows\\System32\\cmd.exe',
  family: 'cmd' as const,
  systemDefault: true,
  agents: [
    {
      agentId: 'claude-cli',
      displayName: 'Claude Code',
      support: 'launch-only' as const,
      note: 'windows-git-bash' as const
    }
  ]
}

const gitBash = {
  id: 'git-bash',
  path: 'C:\\Program Files\\Git\\bin\\bash.exe',
  family: 'bash' as const,
  systemDefault: false,
  agents: [
    {
      agentId: 'claude-cli',
      displayName: 'Claude Code',
      support: 'native' as const,
      note: 'windows-git-bash' as const
    }
  ]
}

const view: ShellCatalogView = {
  shells: [cmd, gitBash],
  selectedId: null,
  resolvedId: 'cmd',
  missingSelection: false
}

function renderPicker(over: Partial<Parameters<typeof ShellPicker>[0]> = {}): {
  onSelect: ReturnType<typeof vi.fn>
  onRefresh: ReturnType<typeof vi.fn>
} {
  const onSelect = vi.fn()
  const onRefresh = vi.fn()
  render(createElement(ShellPicker, { view, onSelect, onRefresh, refreshing: false, ...over }))
  return { onSelect, onRefresh }
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
    expect(screen.getByText(/Segue o padrão do sistema: Prompt de Comando/)).toBeTruthy()
  })

  it('marks the system default row once', () => {
    renderPicker()
    expect(screen.getAllByText('Padrão do sistema')).toHaveLength(1)
  })

  it('says out loud that cmd does not run Claude’s commands (AT-R5)', () => {
    renderPicker()
    expect(screen.getByText(/Claude Code não executa comandos no cmd/)).toBeTruthy()
  })

  it('swaps the caveat when another shell is selected — the one that is true now', () => {
    renderPicker({ view: { ...view, selectedId: 'git-bash' } })
    expect(screen.getByText(/Claude Code executa os comandos deste Git Bash/)).toBeTruthy()
    expect(screen.queryByText(/não executa comandos no cmd/)).toBeNull()
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
      view: { shells: [cmd], selectedId: 'git-bash', resolvedId: 'cmd', missingSelection: true }
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Git Bash')
    expect(alert.textContent).toContain('a escolha volta sozinha')
  })

  it('teaches rather than accuses when no shell was detected at all', () => {
    renderPicker({
      view: { shells: [], selectedId: null, resolvedId: null, missingSelection: false }
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
        missingSelection: false
      }
    })
    expect(screen.getByLabelText('Ksh')).toBeTruthy()
  })
})
