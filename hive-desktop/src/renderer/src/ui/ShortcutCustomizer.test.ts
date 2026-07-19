// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * shortcut-customization — the "Personalizar atalhos" picker.
 *
 * The DS is mocked with trivial stand-ins (the repo's Chat.test.ts /
 * WorkUI.test.ts convention): cmdk's own filtering/keyboard mechanics are the
 * DS Command's concern, covered by its own suite — this file proves the
 * *selection* contract: role defaults pre-checked, toggles persisted
 * immediately (live preview via `onChanged`), and "Restaurar padrão do papel"
 * dropping the customization.
 */

vi.mock('@hive/design-system', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  DialogTitle: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('h2', rest, children),
  DialogDescription: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('p', rest, children),
  Badge: ({ children, variant, ...rest }: { children?: ReactNode; variant?: string }) =>
    createElement('span', { 'data-variant': variant, ...rest }, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Command: ({
    children,
    label,
    loop,
    ...rest
  }: {
    children?: ReactNode
    label?: string
    loop?: boolean
  }) =>
    createElement(
      'div',
      { 'aria-label': label, 'data-loop': loop || undefined, ...rest },
      children
    ),
  CommandInput: ({ placeholder, ...rest }: { placeholder?: string }) =>
    createElement('input', { placeholder, ...rest }),
  CommandList: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  CommandEmpty: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  CommandGroup: ({ heading, children }: { heading?: ReactNode; children?: ReactNode }) =>
    createElement('div', null, createElement('div', null, heading), children),
  CommandItem: ({
    children,
    onSelect,
    shortcut,
    value,
    keywords,
    ...rest
  }: {
    children?: ReactNode
    onSelect?: () => void
    shortcut?: ReactNode
    value?: string
    keywords?: string[]
  }) =>
    createElement(
      'button',
      {
        type: 'button',
        onClick: onSelect,
        'data-value': value,
        'data-keywords': keywords?.join(' '),
        ...rest
      },
      children,
      shortcut
    )
}))

import { ShortcutCustomizer } from './ShortcutCustomizer'
import { commandFilter } from './shortcutSearch'

const CATALOG = [
  {
    key: 'bmad-prd',
    label: 'Create Edit and Review PRD',
    description: 'PRD workflow',
    module: 'bmm',
    kind: 'skill' as const,
    persona: null
  },
  {
    key: 'bmad-spec',
    label: 'bmad-spec',
    description: 'Spec kernel',
    module: 'bmm',
    kind: 'skill' as const,
    persona: null
  },
  {
    key: 'bmad-agent-pm',
    label: 'John',
    description: 'talk to John',
    module: 'bmm',
    kind: 'agent' as const,
    persona: 'John'
  },
  {
    key: 'bmad-tea',
    label: 'Murat',
    description: 'talk to Murat',
    module: 'tea',
    kind: 'agent' as const,
    persona: 'Murat'
  }
]

const PM_DEFAULTS = [
  { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
  {
    key: 'persona-pm',
    kind: 'persona',
    command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
  }
]

function mockHive(options: { prefs?: { skills: string[]; agents: string[] } | null } = {}): {
  set: ReturnType<typeof vi.fn>
} {
  const set = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('hive', {
    shortcuts: {
      catalog: vi.fn().mockResolvedValue(CATALOG),
      get: vi.fn().mockResolvedValue(options.prefs ?? null),
      set,
      actions: vi.fn().mockResolvedValue([])
    },
    profile: {
      roleActions: vi.fn().mockResolvedValue(PM_DEFAULTS)
    }
  } as unknown as typeof window.hive)
  return { set }
}

function renderCustomizer(onChanged = vi.fn()): { onChanged: ReturnType<typeof vi.fn> } {
  render(
    createElement(ShortcutCustomizer, {
      open: true,
      onOpenChange: vi.fn(),
      workspace: '/ws',
      role: 'pm',
      onChanged
    })
  )
  return { onChanged }
}

describe('ShortcutCustomizer', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('pre-checks the role defaults when no customization exists ("Padrão do papel")', async () => {
    mockHive()
    renderCustomizer()

    // Rows render with pt-BR labels (known keys) once catalog + prefs load.
    const prdRow = await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    expect(prdRow.getAttribute('data-checked')).toBe('true')
    // The persona default is checked; the other agent is not.
    expect(
      screen
        .getByRole('button', { name: 'Alternar atalho: Conversar com John' })
        .getAttribute('data-checked')
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Alternar atalho: Conversar com Murat' })
        .getAttribute('data-checked')
    ).toBeNull()
    expect(screen.getByText('Padrão do papel')).toBeTruthy()
    // Live count: prd + John = 2.
    expect(screen.getByText('2 atalhos selecionados')).toBeTruthy()
  })

  it('toggling persists the whole selection immediately and reports the change', async () => {
    const { set } = mockHive()
    const { onChanged } = renderCustomizer()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Alternar atalho: Conversar com Murat' })
    )

    expect(set).toHaveBeenCalledWith({
      skills: ['bmad-prd'],
      agents: ['bmad-agent-pm', 'bmad-tea']
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(screen.getByText('Personalizado')).toBeTruthy()
    expect(screen.getByText('3 atalhos selecionados')).toBeTruthy()

    // Toggling an already-on row removes it from the persisted selection.
    fireEvent.click(screen.getByRole('button', { name: 'Alternar atalho: Criar um PRD' }))
    expect(set).toHaveBeenLastCalledWith({
      skills: [],
      agents: ['bmad-agent-pm', 'bmad-tea']
    })
  })

  it('starts from the stored selection when one exists, and restores the role defaults', async () => {
    const { set } = mockHive({ prefs: { skills: ['bmad-spec'], agents: [] } })
    const { onChanged } = renderCustomizer()

    const specRow = await screen.findByRole('button', { name: 'Alternar atalho: Criar uma spec' })
    expect(specRow.getAttribute('data-checked')).toBe('true')
    expect(screen.getByText('Personalizado')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão do papel' }))

    await waitFor(() => expect(set).toHaveBeenCalledWith(null))
    // Back to the role defaults: badge and checked rows flip.
    await screen.findByText('Padrão do papel')
    expect(
      screen
        .getByRole('button', { name: 'Alternar atalho: Criar um PRD' })
        .getAttribute('data-checked')
    ).toBe('true')
    expect(specRow.getAttribute('data-checked')).toBeNull()
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  // skill-studio: user creations get their own group + the studio entry point.
  it('groups user creations under "Criadas por você" and links to the studio', async () => {
    mockHive()
    vi.mocked(window.hive.shortcuts.catalog).mockResolvedValue([
      ...CATALOG,
      {
        key: 'revisor-notas',
        label: 'Revisor de Notas',
        description: 'Revisa release notes.',
        module: 'custom',
        kind: 'skill' as const,
        persona: null,
        custom: true
      }
    ])
    const onOpenStudio = vi.fn()
    render(
      createElement(ShortcutCustomizer, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        role: 'pm',
        onChanged: vi.fn(),
        onOpenStudio
      })
    )

    expect(await screen.findByText('Criadas por você')).toBeTruthy()
    // The creation is a toggleable row like any other, labeled by its own name.
    expect(screen.getByRole('button', { name: 'Alternar atalho: Revisor de Notas' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Criar skills no Estúdio' }))
    expect(onOpenStudio).toHaveBeenCalled()
  })

  it('explains an empty catalog instead of rendering an empty picker', async () => {
    mockHive()
    vi.mocked(window.hive.shortcuts.catalog).mockResolvedValue([])
    renderCustomizer()

    expect(
      await screen.findByText(
        'Nenhuma skill do BMAD foi encontrada neste workspace. Instale ou atualize o BMAD para personalizar os atalhos.'
      )
    ).toBeTruthy()
  })
})

// The customizer's substring search (cmdk's fuzzy scorer is replaced — see
// commandFilter's doc comment). The DS Command is mocked above, so the
// filter is proven directly.
describe('commandFilter', () => {
  it('matches accent-insensitive substrings over value and keywords', () => {
    expect(commandFilter('Criar uma história bmad-create-story', 'historia')).toBe(1)
    expect(commandFilter('Conversar com Murat', 'qualidade', ['testes e qualidade'])).toBe(1)
    expect(commandFilter('Criar um PRD bmad-prd', 'prd')).toBe(1)
  })

  it('rejects non-substring (fuzzy-only) matches and trims the query', () => {
    expect(commandFilter('Conversar com Mary', 'teste', ['business analyst'])).toBe(0)
    expect(commandFilter('Criar um PRD', '  prd  ')).toBe(1)
    expect(commandFilter('Qualquer', '')).toBe(1)
  })
})
