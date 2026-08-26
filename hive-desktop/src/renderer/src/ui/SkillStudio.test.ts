// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * skill-studio — the "Estúdio de skills".
 *
 * The DS is mocked with trivial stand-ins (the repo's ShortcutCustomizer.test
 * convention). This file proves the studio's contracts: the gallery lists
 * created skills with their evals/pin state, every action becomes a chat
 * launch (test = `/key`, evals = runner-or-builder briefing, create = builder
 * briefing), pins persist through `shortcuts.set`, and delete trashes the
 * skill directory after confirmation.
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
  Spinner: ({ label }: { label?: string }) => createElement('span', null, label),
  Field: ({
    label,
    description,
    children
  }: {
    label?: ReactNode
    description?: ReactNode
    children?: ReactNode
  }) =>
    createElement(
      'label',
      null,
      createElement('span', null, label),
      description ? createElement('span', null, description) : null,
      children
    ),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Textarea: (props: Record<string, unknown>) => {
    // Strip the DS-only autosize props so jsdom's <textarea> doesn't warn.
    const rest = { ...props }
    delete rest.minRows
    delete rest.maxRows
    return createElement('textarea', rest)
  },
  Switch: ({
    checked,
    onCheckedChange
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) =>
    createElement('input', {
      type: 'checkbox',
      role: 'switch',
      checked,
      onChange: () => onCheckedChange?.(!checked)
    }),
  // The run-config selects: a native <select> stand-in (the trigger/value
  // slots collapse to nothing, the content's items become <option>s).
  Select: ({
    value,
    onValueChange,
    disabled,
    children
  }: {
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
    children?: ReactNode
  }) =>
    createElement(
      'select',
      {
        value: value ?? '',
        disabled,
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value)
      },
      children
    ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => children,
  SelectItem: ({ value, children }: { value?: string; children?: ReactNode }) =>
    createElement('option', { value }, children)
}))

import { SkillStudio, type CreatedSkill } from './SkillStudio'
import {
  buildCreationCommand,
  buildEvalCreateCommand,
  buildEvalRunCommand,
  slugify
} from './studioPrompts'

const CREATED: CreatedSkill[] = [
  {
    key: 'revisor-notas',
    name: 'Revisor de Notas',
    description: 'Revisa release notes contra o padrão do time.',
    kind: 'skill',
    persona: null,
    hasEvals: true,
    evalCases: 3,
    relPath: '.claude/skills/revisor-notas',
    updatedAt: Date.now()
  },
  {
    key: 'clara-dados',
    name: 'Clara',
    description: 'Use when the user asks to talk to Clara.',
    kind: 'agent',
    persona: 'Clara',
    hasEvals: false,
    evalCases: 0,
    relPath: '.claude/skills/clara-dados',
    updatedAt: Date.now()
  }
]

const PM_DEFAULTS = [
  { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } }
]

function mockHive(
  options: {
    created?: CreatedSkill[]
    prefs?: { skills: string[]; agents: string[] } | null
  } = {}
): { set: ReturnType<typeof vi.fn>; trash: ReturnType<typeof vi.fn> } {
  const set = vi.fn().mockResolvedValue(undefined)
  const trash = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('hive', {
    studio: { list: vi.fn().mockResolvedValue(options.created ?? CREATED) },
    // shortcut-scopes: the studio pins into the `start` set.
    shortcuts: {
      get: vi.fn().mockResolvedValue({ start: options.prefs ?? null, during: null }),
      set
    },
    profile: {
      roleActions: vi.fn().mockResolvedValue(PM_DEFAULTS),
      // M26: the create form names the agents it can build with, from the same
      // roster the chat's switcher uses.
      agents: vi.fn().mockResolvedValue([
        { id: 'claude-cli', displayName: 'Claude Code' },
        { id: 'copilot-cli', displayName: 'GitHub Copilot' }
      ])
    },
    agent: {
      capabilities: vi.fn().mockResolvedValue({
        models: [
          { id: 'opus', label: 'Opus' },
          { id: 'sonnet', label: 'Sonnet' }
        ],
        efforts: [
          { id: 'low', label: 'Low' },
          { id: 'high', label: 'High' }
        ],
        supportsAttachments: true
      })
    },
    fs: { trash }
  } as unknown as typeof window.hive)
  return { set, trash }
}

interface Callbacks {
  onLaunch: ReturnType<typeof vi.fn>
  onOpenChange: ReturnType<typeof vi.fn>
  onShortcutsChanged: ReturnType<typeof vi.fn>
  onOpenFile: ReturnType<typeof vi.fn>
}

function renderStudio(props: { agents?: string[]; defaultAgent?: string | null } = {}): Callbacks {
  const callbacks: Callbacks = {
    onLaunch: vi.fn(),
    onOpenChange: vi.fn(),
    onShortcutsChanged: vi.fn(),
    onOpenFile: vi.fn()
  }
  render(
    createElement(SkillStudio, {
      open: true,
      workspace: '/ws',
      role: 'pm',
      agents: props.agents ?? ['claude-cli', 'copilot-cli'],
      defaultAgent: props.defaultAgent ?? 'claude-cli',
      ...callbacks
    })
  )
  return callbacks
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SkillStudio', () => {
  it('lists creations with kind, command, and evals state', async () => {
    mockHive()
    renderStudio()

    expect(await screen.findByText('Revisor de Notas')).toBeTruthy()
    expect(screen.getByText('/revisor-notas')).toBeTruthy()
    expect(screen.getByText('3 evals')).toBeTruthy()
    // The agent card: persona identity + no-evals state.
    expect(screen.getByText('Clara')).toBeTruthy()
    expect(screen.getByText('Sem evals')).toBeTruthy()
    expect(screen.getByText('Agente')).toBeTruthy()
  })

  it('"Testar no chat" launches the /key turn and closes', async () => {
    mockHive()
    const { onLaunch, onOpenChange } = renderStudio()

    fireEvent.click(await screen.findByRole('button', { name: 'Testar Revisor de Notas no chat' }))

    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'workflow',
        command: { key: 'revisor-notas', prompt: '/revisor-notas' }
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('the agent card launches as a persona action', async () => {
    mockHive()
    const { onLaunch } = renderStudio()
    fireEvent.click(await screen.findByRole('button', { name: 'Testar Clara no chat' }))
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'persona' }))
  })

  it('evals CTA runs the eval-runner when evals exist, or briefs the builder to add them', async () => {
    mockHive()
    const { onLaunch } = renderStudio()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rodar os evals de Revisor de Notas' })
    )
    expect(onLaunch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          key: 'bmad-eval-runner',
          prompt: '/bmad-eval-runner .claude/skills/revisor-notas'
        })
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Gerar evals para Clara' }))
    const briefing = onLaunch.mock.calls.at(-1)?.[0].command.prompt as string
    expect(briefing.startsWith('/bmad-workflow-builder')).toBe(true)
    expect(briefing).toContain('.claude/skills/clara-dados')
  })

  it('pinning persists defaults + the creation, and reports the change', async () => {
    const { set } = mockHive()
    const { onShortcutsChanged } = renderStudio()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Fixar Revisor de Notas nos atalhos para iniciar' })
    )
    expect(set).toHaveBeenCalledWith('start', {
      skills: ['bmad-prd', 'revisor-notas'],
      agents: []
    })
    await waitFor(() => expect(onShortcutsChanged).toHaveBeenCalled())

    // Agent pins land on the agents list; the stored selection is now the baseline.
    fireEvent.click(screen.getByRole('button', { name: 'Fixar Clara nos atalhos para iniciar' }))
    expect(set).toHaveBeenLastCalledWith('start', {
      skills: ['bmad-prd', 'revisor-notas'],
      agents: ['clara-dados']
    })
  })

  it('a failed trash keeps the dialog open with an inline error, and the card stays', async () => {
    const { trash } = mockHive()
    trash.mockRejectedValue(new Error('EACCES'))
    renderStudio()

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Revisor de Notas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    expect(await screen.findByText('Não foi possível excluir. Tente novamente.')).toBeTruthy()
    expect(screen.getByText('Revisor de Notas')).toBeTruthy()
  })

  it('evals present but uncountable read as "Evals prontos"', async () => {
    mockHive({
      created: [{ ...CREATED[0], hasEvals: true, evalCases: 0 }]
    })
    renderStudio()
    expect(await screen.findByText('Evals prontos')).toBeTruthy()
  })

  it('shows the loading state while the scan is in flight', async () => {
    mockHive()
    vi.mocked(window.hive.studio.list).mockReturnValue(new Promise(() => {}))
    renderStudio()
    expect(await screen.findByText('Procurando suas criações…')).toBeTruthy()
  })

  it('starts pinned from stored prefs and unpins in place', async () => {
    const { set } = mockHive({ prefs: { skills: ['revisor-notas'], agents: [] } })
    renderStudio()

    expect(await screen.findByText('Nos atalhos')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Tirar Revisor de Notas dos atalhos para iniciar' })
    )
    expect(set).toHaveBeenCalledWith('start', { skills: [], agents: [] })
  })

  it('opens SKILL.md in the editor', async () => {
    mockHive()
    const { onOpenFile, onOpenChange } = renderStudio()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir o SKILL.md de Revisor de Notas no editor' })
    )
    expect(onOpenFile).toHaveBeenCalledWith('.claude/skills/revisor-notas/SKILL.md')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('delete asks for confirmation, trashes the directory, and drops the card', async () => {
    const { trash } = mockHive()
    renderStudio()

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Revisor de Notas' }))
    expect(screen.getByText('Excluir esta criação?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))
    await waitFor(() => expect(trash).toHaveBeenCalledWith('/ws', '.claude/skills/revisor-notas'))
    await waitFor(() => expect(screen.queryByText('Revisor de Notas')).toBeNull())
  })

  it('the empty state offers the two creation paths and the form briefs the builder', async () => {
    mockHive({ created: [] })
    const { onLaunch } = renderStudio()

    fireEvent.click(await screen.findByRole('button', { name: /Uma skill/ }))

    fireEvent.change(screen.getByPlaceholderText('ex.: Revisor de release notes'), {
      target: { value: 'Guia de Estilo' }
    })
    // Live slug preview: the durable /command forming as the user types.
    expect(screen.getByText('Vai virar o comando /guia-de-estilo')).toBeTruthy()

    fireEvent.change(
      screen.getByPlaceholderText(
        'Descreva o objetivo, quando deve ser usada e como é um bom resultado. Quanto mais contexto, melhor o construtor trabalha.'
      ),
      { target: { value: 'Aplicar o guia de estilo do time em qualquer texto.' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Criar com o Construtor/ }))

    const briefing = onLaunch.mock.calls.at(-1)?.[0].command.prompt as string
    expect(briefing.startsWith('/bmad-workflow-builder')).toBe(true)
    expect(briefing).toContain('.claude/skills/guia-de-estilo/')
    expect(briefing).toContain('Aplicar o guia de estilo do time em qualquer texto.')
    // withEvals defaults ON — the briefing carries the eval instruction.
    expect(briefing).toContain('evals/cases.json')
    // Creating opens a *new* conversation and carries the run-config defaults
    // (first model/effort from capabilities) as a per-turn override.
    expect(onLaunch.mock.calls.at(-1)?.[1]).toMatchObject({
      newConversation: true,
      model: 'opus',
      effort: 'low'
    })
  })

  it('the run-config picker rides the chosen model into the create launch', async () => {
    mockHive({ created: [] })
    const { onLaunch } = renderStudio()

    fireEvent.click(await screen.findByRole('button', { name: /Uma skill/ }))
    fireEvent.change(screen.getByPlaceholderText('ex.: Revisor de release notes'), {
      target: { value: 'Guia de Estilo' }
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Descreva o objetivo, quando deve ser usada e como é um bom resultado. Quanto mais contexto, melhor o construtor trabalha.'
      ),
      { target: { value: 'Aplicar o guia de estilo.' } }
    )
    // Two run-config selects (model, effort) once capabilities land — pick the
    // second model and confirm it overrides the default on launch.
    const selects = await waitFor(() => {
      const found = screen.getAllByRole('combobox')
      expect(found.length).toBe(2)
      return found
    })
    fireEvent.change(selects[0], { target: { value: 'sonnet' } })
    fireEvent.change(selects[1], { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar com o Construtor/ }))

    expect(onLaunch.mock.calls.at(-1)?.[1]).toMatchObject({
      newConversation: true,
      agentId: 'claude-cli',
      model: 'sonnet',
      effort: 'high'
    })
  })

  /**
   * M26 — the build *is* a conversation, so whoever the create form picks is
   * also whoever the user goes on talking to. Before this the studio silently
   * inherited the app default, which meant a squad running Copilot in chat
   * still had every skill built by Claude.
   */
  describe('choosing the builder agent', () => {
    async function openCreateForm(): Promise<void> {
      fireEvent.click(await screen.findByRole('button', { name: /Uma skill/ }))
      fireEvent.change(screen.getByPlaceholderText('ex.: Revisor de release notes'), {
        target: { value: 'Guia de Estilo' }
      })
      fireEvent.change(
        screen.getByPlaceholderText(
          'Descreva o objetivo, quando deve ser usada e como é um bom resultado. Quanto mais contexto, melhor o construtor trabalha.'
        ),
        { target: { value: 'Aplicar o guia de estilo.' } }
      )
    }

    it('rides the chosen agent into the launch, alongside model and effort', async () => {
      mockHive({ created: [] })
      const { onLaunch } = renderStudio()
      await openCreateForm()

      const copilot = await screen.findByRole('radio', { name: /GitHub Copilot/ })
      fireEvent.click(copilot)

      await waitFor(() => expect(copilot.getAttribute('aria-checked')).toBe('true'))
      fireEvent.click(screen.getByRole('button', { name: /Criar com o Construtor/ }))

      expect(onLaunch.mock.calls.at(-1)?.[1]).toMatchObject({
        newConversation: true,
        agentId: 'copilot-cli'
      })
    })

    it('re-reads capabilities for the agent it switched to', async () => {
      mockHive({ created: [] })
      renderStudio()
      await openCreateForm()
      await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))

      fireEvent.click(screen.getByRole('radio', { name: /GitHub Copilot/ }))

      await waitFor(() =>
        expect(window.hive.agent.capabilities).toHaveBeenCalledWith('copilot-cli')
      )
    })

    it('offers no picker at all when there is only one agent to pick', async () => {
      mockHive({ created: [] })
      renderStudio({ agents: ['claude-cli'] })
      await openCreateForm()

      await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(2))
      expect(screen.queryByRole('radio', { name: /Claude Code/ })).toBeNull()
    })
  })
})

describe('studioPrompts', () => {
  it('slugify folds accents and squeezes separators', () => {
    expect(slugify('Revisor de Notas')).toBe('revisor-de-notas')
    expect(slugify('  Análise & Métricas!  ')).toBe('analise-metricas')
    expect(slugify('---')).toBe('')
  })

  it('agent briefings go to bmad-agent-builder with the talk-to recognition phrase', () => {
    const command = buildCreationCommand({
      kind: 'agent',
      name: 'Clara dos Dados',
      idea: 'Especialista em análise de dados.',
      persona: 'Clara',
      withEvals: false
    })
    expect(command.key).toBe('bmad-agent-builder')
    expect(command.prompt.startsWith('/bmad-agent-builder')).toBe(true)
    expect(command.prompt).toContain('Use when the user asks to talk to Clara')
    expect(command.prompt).toContain('.claude/skills/clara-dos-dados/')
    expect(command.prompt).not.toContain('evals/cases.json')
  })

  it('falls back to a safe slug and to the name as persona', () => {
    const command = buildCreationCommand({
      kind: 'agent',
      name: '###',
      idea: 'x',
      withEvals: true
    })
    expect(command.prompt).toContain('.claude/skills/nova-skill/')
    expect(command.prompt).toContain('talk to ###')
    expect(command.prompt).toContain('evals/cases.json')
  })

  it('eval commands target the skill path', () => {
    expect(buildEvalRunCommand({ relPath: '.claude/skills/x' }).prompt).toBe(
      '/bmad-eval-runner .claude/skills/x'
    )
    const create = buildEvalCreateCommand({ key: 'x', relPath: '.claude/skills/x' })
    expect(create.prompt).toContain('.claude/skills/x')
    expect(create.prompt).toContain('evals/cases.json')
  })
})
