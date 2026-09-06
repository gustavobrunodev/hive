// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * shortcut-customization + shortcut-scopes — the "Personalizar atalhos" picker.
 *
 * The DS is mocked with trivial stand-ins (the repo's Chat.test.ts /
 * WorkUI.test.ts convention): cmdk's own filtering/keyboard mechanics are the
 * DS Command's concern, covered by its own suite — this file proves the
 * *selection* contract: role defaults pre-checked per scope, toggles persisted
 * immediately to the visible scope only (live preview via `onChanged`), and
 * "Restaurar padrão do papel" dropping that scope's customization alone.
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
  // Enough of the real radiogroup to drive the scope switch: one button per
  // option, labelled "<label> <count>" so a test can click it by name.
  SegmentedControl: ({
    options,
    value,
    onChange,
    ariaLabel
  }: {
    options: { id: string; label: string; count?: number }[]
    value?: string
    onChange?: (id: string) => void
    ariaLabel?: string
  }) =>
    createElement(
      'div',
      { role: 'radiogroup', 'aria-label': ariaLabel },
      options.map((option) =>
        createElement(
          'button',
          {
            key: option.id,
            type: 'button',
            role: 'radio',
            'aria-checked': option.id === value,
            onClick: () => onChange?.(option.id)
          },
          `${option.label} ${option.count ?? ''}`.trim()
        )
      )
    ),
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

// `as const` on `kind`: the bridge's own type narrows it to the two-value
// union, and a test that re-mocks `roleActions` directly (rather than through
// `mockHive`'s cast) is checked against it.
const PM_DEFAULTS = [
  { key: 'prd', kind: 'workflow' as const, command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
  {
    key: 'persona-pm',
    kind: 'persona' as const,
    command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
  }
]

/** The PM's in-conversation default — the only one in the catalog. */
const PM_DURING_DEFAULTS = [
  {
    key: 'party-mode',
    kind: 'workflow' as const,
    command: { key: 'bmad-spec', prompt: '/bmad-spec' }
  }
]

type Prefs = { skills: string[]; agents: string[] } | null

function mockHive(options: { settings?: { start: Prefs; during: Prefs } } = {}): {
  set: ReturnType<typeof vi.fn>
} {
  const set = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('hive', {
    shortcuts: {
      catalog: vi.fn().mockResolvedValue(CATALOG),
      get: vi.fn().mockResolvedValue(options.settings ?? { start: null, during: null }),
      set,
      actions: vi.fn().mockResolvedValue({ start: [], during: [] })
    },
    profile: {
      roleActions: vi
        .fn()
        .mockImplementation(async (_role: string, scope?: string) =>
          scope === 'during' ? PM_DURING_DEFAULTS : PM_DEFAULTS
        )
    }
  } as unknown as typeof window.hive)
  return { set }
}

function renderCustomizer(
  onChanged = vi.fn(),
  initialScope?: 'start' | 'during'
): { onChanged: ReturnType<typeof vi.fn> } {
  render(
    createElement(ShortcutCustomizer, {
      open: true,
      onOpenChange: vi.fn(),
      workspace: '/ws',
      role: 'pm',
      initialScope,
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

    expect(set).toHaveBeenCalledWith('start', {
      skills: ['bmad-prd'],
      agents: ['bmad-agent-pm', 'bmad-tea']
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(screen.getByText('Personalizado')).toBeTruthy()
    expect(screen.getByText('3 atalhos selecionados')).toBeTruthy()

    // Toggling an already-on row removes it from the persisted selection.
    fireEvent.click(screen.getByRole('button', { name: 'Alternar atalho: Criar um PRD' }))
    expect(set).toHaveBeenLastCalledWith('start', {
      skills: [],
      agents: ['bmad-agent-pm', 'bmad-tea']
    })
  })

  it('starts from the stored selection when one exists, and restores the role defaults', async () => {
    const { set } = mockHive({
      settings: { start: { skills: ['bmad-spec'], agents: [] }, during: null }
    })
    const { onChanged } = renderCustomizer()

    const specRow = await screen.findByRole('button', { name: 'Alternar atalho: Criar uma spec' })
    expect(specRow.getAttribute('data-checked')).toBe('true')
    expect(screen.getByText('Personalizado')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }))

    await waitFor(() => expect(set).toHaveBeenCalledWith('start', null))
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

    fireEvent.click(screen.getByRole('button', { name: 'Criar no Estúdio' }))
    expect(onOpenStudio).toHaveBeenCalled()
  })

  it('explains an empty catalog instead of rendering an empty picker', async () => {
    mockHive()
    vi.mocked(window.hive.shortcuts.catalog).mockResolvedValue([])
    renderCustomizer()

    expect(await screen.findByText(/Nenhuma skill do BMAD foi encontrada/)).toBeTruthy()
  })

  /**
   * The case that made "remove a role default" impossible rather than merely
   * awkward: a workspace BMAD was never installed into. There is no catalog, so
   * the list below has nothing to offer — and the shortcuts on screen still
   * have to be removable. The set at the top is the only control there is, and
   * it has to keep drawing keys it cannot look up.
   */
  it('still draws — and removes — the set when the workspace has no catalog', async () => {
    mockHive()
    vi.mocked(window.hive.shortcuts.catalog).mockResolvedValue([])
    const { onChanged } = renderCustomizer()

    fireEvent.click(await screen.findByRole('button', { name: 'Remover atalho: Criar um PRD' }))

    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith('start', {
        skills: [],
        agents: ['bmad-agent-pm']
      })
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})

// shortcut-scopes: two independent sets behind one segmented switch.
describe('ShortcutCustomizer — scopes', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('switches sets, each pre-checked from its own role defaults', async () => {
    mockHive()
    renderCustomizer()

    // Start: the PM's hero defaults (prd + John), counted on the segment.
    await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    expect(screen.getByRole('radio', { name: 'Para iniciar 2' }).getAttribute('aria-checked')).toBe(
      'true'
    )
    expect(screen.getByText(/Na tela inicial, antes da primeira mensagem/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Durante a conversa 1' }))

    // During: only the in-conversation default is checked now.
    expect(screen.getByText(/Acima do campo de mensagem/)).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Alternar atalho: Criar um PRD' })
        .getAttribute('data-checked')
    ).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Alternar atalho: Criar uma spec' })
        .getAttribute('data-checked')
    ).toBe('true')
    expect(screen.getByText('1 atalho selecionado')).toBeTruthy()
  })

  it('persists a toggle to the visible scope only', async () => {
    const { set } = mockHive()
    renderCustomizer(vi.fn(), 'during')

    await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    fireEvent.click(screen.getByRole('button', { name: 'Alternar atalho: Criar um PRD' }))

    expect(set).toHaveBeenCalledWith('during', {
      skills: ['bmad-spec', 'bmad-prd'],
      agents: []
    })
    // The other set was never written — the whole point of the split.
    expect(set).not.toHaveBeenCalledWith('start', expect.anything())
  })

  it('opens on the scope the caller asked for', async () => {
    mockHive()
    renderCustomizer(vi.fn(), 'during')

    await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    expect(
      screen.getByRole('radio', { name: 'Durante a conversa 1' }).getAttribute('aria-checked')
    ).toBe('true')
  })

  it('badges each scope on its own state, not the other one', async () => {
    mockHive({ settings: { start: { skills: ['bmad-spec'], agents: [] }, during: null } })
    renderCustomizer()

    await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    expect(screen.getByText('Personalizado')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Durante a conversa 1' }))
    expect(screen.getByText('Padrão do papel')).toBeTruthy()
    // Nothing to restore on an untouched scope.
    expect(screen.queryByRole('button', { name: 'Restaurar padrão' })).toBeNull()
  })

  it('draws the selection where it will land, and teaches an empty set', async () => {
    mockHive({ settings: { start: { skills: [], agents: [] }, during: null } })
    renderCustomizer()

    // Empty start set → the hero stage says what that means.
    expect(await screen.findByText(/a tela inicial fica só com o campo de mensagem/)).toBeTruthy()
    // Nothing to empty, so no bulk action either.
    expect(screen.queryByRole('button', { name: 'Remover todos' })).toBeNull()

    // The during set has its default, so the stage draws it as a chip.
    fireEvent.click(screen.getByRole('radio', { name: 'Durante a conversa 1' }))
    const stage = screen.getByLabelText('Atalhos de Durante a conversa')
    expect(stage.textContent).toContain('Criar uma spec')
  })

  /**
   * The gesture this round exists for. Removing is not a search problem — you
   * are looking at the thing you want gone — so it lives on the chip, not sixty
   * rows down the catalog. Both scopes, because the report named both.
   */
  it('removes one shortcut from the visible scope by clicking its chip', async () => {
    mockHive()
    const { onChanged } = renderCustomizer()

    fireEvent.click(await screen.findByRole('button', { name: 'Remover atalho: Criar um PRD' }))
    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith('start', {
        skills: [],
        agents: ['bmad-agent-pm']
      })
    )
    expect(onChanged).toHaveBeenCalled()
    // The scope is the user's now, and reversible.
    expect(screen.getByText('Personalizado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restaurar padrão' })).toBeTruthy()
  })

  /**
   * The stage draws the surface, so it has to resolve the surface's way — and
   * `main/roleCatalog.ts` does NOT validate role defaults against the catalog.
   * A workspace with a partial BMAD install renders defaults it cannot look up;
   * a stage that dropped them showed fewer chips than the hero it was drawing,
   * and the missing ones had no way out at all. Caught by e2e/shortcut-removal,
   * where the seeded catalog really is partial.
   */
  it('draws a role default the catalog does not have, and lets it go', async () => {
    mockHive()
    // A default this workspace has no catalog row for — the partial-install case.
    vi.mocked(window.hive.profile.roleActions).mockImplementation(async (_role, scope) =>
      scope === 'during'
        ? []
        : [
            {
              key: 'dev-story',
              kind: 'workflow' as const,
              command: { key: 'bmad-dev-story', prompt: '/bmad-dev-story' }
            },
            ...PM_DEFAULTS
          ]
    )
    renderCustomizer()

    // Labelled by the renderer's own pt-BR map, which knows the key even
    // though this workspace's catalog does not have a row for it.
    const orphan = await screen.findByRole('button', {
      name: 'Remover atalho: Implementar uma história'
    })
    fireEvent.click(orphan)

    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith('start', {
        skills: ['bmad-prd'],
        agents: ['bmad-agent-pm']
      })
    )
  })

  it('removes an in-conversation default from the other scope, and only that scope', async () => {
    mockHive()
    renderCustomizer()
    await screen.findByRole('button', { name: 'Remover atalho: Criar um PRD' })

    fireEvent.click(screen.getByRole('radio', { name: 'Durante a conversa 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover atalho: Criar uma spec' }))

    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith('during', { skills: [], agents: [] })
    )
    // `start` was never rewritten by any of it.
    expect(window.hive.shortcuts.set).not.toHaveBeenCalledWith('start', expect.anything())
  })

  it('empties the visible scope in one gesture, leaving the other alone', async () => {
    mockHive()
    renderCustomizer()
    await screen.findByRole('button', { name: 'Remover atalho: Criar um PRD' })

    fireEvent.click(screen.getByRole('button', { name: 'Remover todos' }))
    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith('start', { skills: [], agents: [] })
    )
    expect(await screen.findByText(/a tela inicial fica só com o campo de mensagem/)).toBeTruthy()
    expect(window.hive.shortcuts.set).not.toHaveBeenCalledWith('during', expect.anything())
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
