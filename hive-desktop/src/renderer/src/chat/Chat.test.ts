// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, createRef, useContext, type ReactNode } from 'react'
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Chat, type ChatHandle } from './Chat'
import { workspaceRelative } from './toolActivity'
import type { RoleAction } from '../ui/ActionRail'
import { ReviewProvider, type ReviewStore } from '../scm/useReview'

/**
 * Chat UI tests. Covers the role-personalized hero (RP-R4), the launch handle
 * (RP-R5), the interrupt Stop control (chat-controls CC-R1), the `/`
 * slash-command menu (CC-R2), and the active-agent indicator + session re-bind
 * (agent-selection AG-R3.3 / AG-C4).
 *
 * `@hive/design-system` gets DOM stand-ins (a real render would load a second
 * React instance from the DS's own node_modules); `window.hive` is mocked per
 * test. `PromptInput` is a controlled `value`/`onChange` input plus a send
 * button, so tests can type `/` (opening the slash menu) and submit.
 */
/** Drops the DS Button's brand-register props before they reach the DOM stand-in. */
function omitButtonProps(props: Record<string, unknown>): Record<string, unknown> {
  const { cut, arrow, variant, ...rest } = props
  void cut
  void arrow
  void variant
  return rest
}

const SelectContext = createContext<{ onValueChange?: (value: string) => void } | null>(null)
const DropdownRadioContext = createContext<{ onValueChange?: (value: string) => void } | null>(null)
// session-usage: the context sheet is a DS Popover. The stand-in keeps the
// real open/closed contract (content mounts only while open) so a test can
// still prove the detail is *behind* the meter rather than always on screen.
const PopoverContext = createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
} | null>(null)

vi.mock('@hive/design-system', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
    createElement('button', { onClick: onSelect }, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuRadioGroup: ({
    children,
    onValueChange
  }: {
    children?: ReactNode
    onValueChange?: (value: string) => void
  }) => createElement(DropdownRadioContext.Provider, { value: { onValueChange } }, children),
  DropdownMenuRadioItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(DropdownRadioContext)
    return createElement('button', { onClick: () => ctx?.onValueChange?.(value) }, children)
  },
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement(
      'div',
      { role: 'alert', ...rest },
      createElement('strong', null, title),
      children
    ),
  ChatMessage: ({ role, children }: { role: string; children?: ReactNode }) =>
    createElement('div', { 'data-role': role }, children),
  MessageList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  Attachment: ({
    name,
    meta,
    icon,
    onRemove,
    removeLabel,
    ...rest
  }: {
    name?: ReactNode
    meta?: ReactNode
    icon?: ReactNode
    onRemove?: () => void
    removeLabel?: string
  }) =>
    createElement(
      'div',
      rest,
      icon,
      createElement('span', null, name),
      meta !== undefined && createElement('span', null, meta),
      onRemove &&
        createElement('button', { 'aria-label': removeLabel, onClick: onRemove }, 'remover')
    ),
  PromptInput: ({
    value,
    onChange,
    onSubmit,
    placeholder,
    sendLabel,
    streaming,
    onStop,
    stopLabel,
    toolbar,
    toolbarOverlay,
    highlighted,
    attachments,
    allowEmptySubmit,
    highlight,
    textareaRef,
    ...rest
  }: {
    value?: string
    onChange?: (value: string) => void
    onSubmit: (value: string) => void
    placeholder?: string
    sendLabel?: string
    streaming?: boolean
    onStop?: () => void
    stopLabel?: string
    toolbar?: ReactNode
    toolbarOverlay?: ReactNode
    highlighted?: boolean
    attachments?: ReactNode
    allowEmptySubmit?: boolean
    highlight?: (value: string) => ReactNode
    textareaRef?: (node: HTMLElement | null) => void
  }) => {
    // Mirrors the real PromptInput's unified send⇄stop control: while
    // streaming with an onStop handler, the one button becomes the stop
    // control (enabled, labelled stopLabel).
    const stopMode = Boolean(streaming) && onStop !== undefined
    return createElement(
      'div',
      { ...rest, 'data-highlighted': highlighted === true ? 'true' : undefined },
      attachments,
      highlight && createElement('div', { 'aria-hidden': true }, highlight(value ?? '')),
      createElement('input', {
        placeholder,
        ref: textareaRef,
        value: value ?? '',
        onChange: (event: { target: { value: string } }) => onChange?.(event.target.value)
      }),
      createElement(
        'button',
        {
          'aria-label': stopMode ? stopLabel : sendLabel,
          disabled: stopMode
            ? false
            : streaming || ((value ?? '').trim() === '' && !allowEmptySubmit),
          onClick: stopMode ? onStop : () => onSubmit((value ?? '').trim())
        },
        stopMode ? stopLabel : sendLabel
      ),
      // Alternatives, not layers — mirrors the real component (VP-R5.4).
      toolbarOverlay === undefined ? toolbar : toolbarOverlay
    )
  },
  LevelMeter: ({ label, levels }: { label?: string; levels?: number[] }) =>
    createElement('div', {
      role: 'meter',
      'aria-label': label,
      'data-signal': (levels ?? []).some((level) => level > 0.02) ? 'live' : 'none'
    }),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    // The DS Button's brand-register props (`cut`/`arrow`/`variant`) are
    // dropped: they'd land on the DOM node as unknown attributes and React
    // would warn on every render.
    createElement(
      'button',
      { type: 'button', ...omitButtonProps(rest as Record<string, unknown>) },
      children
    ),
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  TypingIndicator: ({ label }: { label?: string }) =>
    createElement('span', { 'data-testid': 'typing-indicator' }, label),
  Select: ({
    children,
    onValueChange
  }: {
    children?: ReactNode
    onValueChange?: (value: string) => void
  }) => createElement(SelectContext.Provider, { value: { onValueChange } }, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(SelectContext)
    return createElement('button', { onClick: () => ctx?.onValueChange?.(value) }, children)
  },
  Popover: ({
    children,
    open,
    onOpenChange
  }: {
    children?: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => createElement(PopoverContext.Provider, { value: { open, onOpenChange } }, children),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(PopoverContext)
    // `asChild` in the real component: the trigger IS its child, so the click
    // handler rides on a wrapper here rather than replacing the child's own.
    return createElement(
      'div',
      { onClick: () => ctx?.onOpenChange?.(ctx?.open !== true) },
      children
    )
  },
  PopoverContent: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const ctx = useContext(PopoverContext)
    return ctx?.open === true ? createElement('div', { className }, children) : null
  }
}))

/**
 * voice-prompt: the microphone is faked at `micCapture`'s own seam, so these
 * tests exercise the real hook, the real segmenter and the real join — only
 * WebAudio is stood in for, since jsdom has none.
 */
const capture = vi.hoisted(() => {
  const state = {
    tickListeners: [] as ((tick: { rms: number; samples: Float32Array }) => void)[],
    levelListeners: [] as ((levels: number[]) => void)[],
    stopped: 0,
    fail: null as Error | null
  }
  return {
    state,
    reset(): void {
      state.tickListeners = []
      state.levelListeners = []
      state.stopped = 0
      state.fail = null
    },
    /** Feeds `ms` of audio at one level, in 32 ms ticks. */
    emit(ms: number, rms: number): void {
      for (let i = 0; i < Math.ceil(ms / 32); i += 1) {
        for (const listener of state.tickListeners) {
          listener({ rms, samples: new Float32Array(512).fill(rms) })
        }
      }
    }
  }
})

vi.mock('../dictation/micCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dictation/micCapture')>()
  return {
    ...actual,
    startCapture: async () => {
      if (capture.state.fail !== null) throw capture.state.fail
      return {
        onTick: (listener: (tick: { rms: number; samples: Float32Array }) => void) =>
          capture.state.tickListeners.push(listener),
        onLevels: (listener: (levels: number[]) => void) =>
          capture.state.levelListeners.push(listener),
        stop: () => {
          capture.state.stopped += 1
        }
      }
    }
  }
})

/** The Whisper engine, faked so a transcript is deterministic and instant. */
const whisper = vi.hoisted(() => ({ text: 'arquivo de configuração', calls: 0 }))

vi.mock('../secondBrain/whisper/useWhisper', () => ({
  DEFAULT_LANGUAGE: 'portuguese',
  useWhisper: () => ({
    phase: { status: 'idle' },
    transcribe: async () => {
      whisper.calls += 1
      return whisper.text
    },
    reset: () => undefined
  })
}))

describe('Chat', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  interface AgentEventLike {
    type: string
    text?: string
    message?: string
    id?: string
    // agent-activity `tool` fields.
    name?: string
    detail?: string
    toolId?: string
    phase?: 'start' | 'end'
    ok?: boolean
    // agent-approvals `approval` fields.
    requestId?: string
    tool?: string
    input?: Record<string, unknown>
    // session-usage `usage` fields.
    usage?: {
      inputTokens: number
      cacheReadTokens: number
      cacheCreationTokens: number
      outputTokens: number
      model?: string
      costUsd?: number
      durationMs?: number
      apiDurationMs?: number
    }
    final?: boolean
  }

  // Mirrors roleCatalog's real shape: every action's prompt is its skill's
  // slash command (the shortcut IS the slash command).
  const roleActions: RoleAction[] = [
    { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
    {
      key: 'brainstorm',
      kind: 'workflow',
      command: { key: 'bmad-brainstorming', prompt: '/bmad-brainstorming' }
    },
    {
      key: 'persona-pm',
      kind: 'persona',
      command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
    }
  ]

  interface StoredSessionLike {
    id: string
    workspace: string
    agent: string | null
    title: string
    createdAt: number
    updatedAt: number
    messages: Array<{ id: string; role: 'user' | 'assistant'; text: string; at: number }>
    cliSessionId?: string | null
  }

  interface SessionMetaLike {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messageCount: number
    agent: string | null
    preview: string
  }

  const CREATED_SESSION: StoredSessionLike = {
    id: 'session-1',
    workspace: '/ws',
    agent: 'claude-cli',
    title: '',
    createdAt: 1,
    updatedAt: 1,
    messages: []
  }

  function mockHive(
    options: {
      skills?: Array<{ key: string; label: string; description: string }>
      recentSessions?: SessionMetaLike[]
      storedSession?: StoredSessionLike
      /** chat-attachments: the workspace file list feeding the `#` mention menu. */
      workspaceFiles?: string[]
      /** chat-attachments: what the native picker resolves with. */
      pickedAttachments?: Array<{ path: string; name: string; size: number }>
      /**
       * multi-agent: an adapter's advertised model/effort menus. Overridable
       * because Devin and Copilot advertise NEITHER, and the composer's
       * "hide the picker, leave the value null" path only exists for them.
       */
      capabilities?: { models: unknown[]; efforts: unknown[]; supportsAttachments?: boolean }
    } = {}
  ): {
    emit: (event: AgentEventLike) => void
    startCalls: Array<{ agentId?: string; workspace: string; model?: string; effort?: string }>
    chatHistory: {
      list: ReturnType<typeof vi.fn>
      get: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      append: ReturnType<typeof vi.fn>
      rename: ReturnType<typeof vi.fn>
      setCliSession: ReturnType<typeof vi.fn>
      search: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
    }
  } {
    let capturedOnEvent: ((event: AgentEventLike) => void) | undefined
    const startCalls: Array<{
      agentId?: string
      workspace: string
      model?: string
      effort?: string
    }> = []
    const chatHistory = {
      list: vi.fn().mockResolvedValue(options.recentSessions ?? []),
      get: vi.fn().mockResolvedValue(options.storedSession ?? null),
      create: vi.fn().mockResolvedValue(CREATED_SESSION),
      append: vi.fn().mockResolvedValue(null),
      rename: vi.fn().mockResolvedValue(null),
      setCliSession: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined)
    }
    window.hive = {
      ...window.hive,
      listFiles: vi.fn().mockResolvedValue(options.workspaceFiles ?? []),
      agent: {
        capabilities: vi.fn().mockResolvedValue(
          options.capabilities ?? {
            // session-usage: the context meter's denominator comes off the
            // model list, so the default caps declare one.
            models: [
              { id: 'model-a', label: 'Modelo A', contextWindow: 200_000 },
              { id: 'model-b', label: 'Modelo B', contextWindow: 200_000 }
            ],
            efforts: [{ id: 'low', label: 'Baixo' }],
            supportsAttachments: true
          }
        ),
        chooseAttachments: vi.fn().mockResolvedValue(options.pickedAttachments ?? []),
        start: vi.fn(
          (opts: { agentId?: string; workspace: string; model?: string; effort?: string }) => {
            startCalls.push(opts)
            return Promise.resolve()
          }
        ),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        interrupt: vi.fn().mockResolvedValue(undefined),
        respondApproval: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn((onEvent: (event: AgentEventLike) => void) => {
          capturedOnEvent = onEvent
          return vi.fn()
        })
      },
      profile: {
        agents: vi.fn().mockResolvedValue([
          {
            id: 'claude-cli',
            displayName: 'Claude Code',
            description: '',
            available: true,
            installHint: '',
            docsUrl: ''
          }
        ])
      },
      skills: {
        list: vi.fn().mockResolvedValue(options.skills ?? [])
      },
      chatHistory
    } as unknown as typeof window.hive
    return { emit: (event: AgentEventLike) => capturedOnEvent?.(event), startCalls, chatHistory }
  }

  function renderChat(
    extra: Parameters<typeof mockHive>[0] = {},
    props: {
      userName?: string | null
      onCustomizeShortcuts?: () => void
      roleActions?: RoleAction[]
    } = {}
  ): ReturnType<typeof mockHive> {
    const hive = mockHive(extra)
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ...props
      })
    )
    return hive
  }

  it('renders the role actions as the hero, with the persona action set apart', async () => {
    renderChat()
    expect(screen.getByText('O que você quer fazer hoje?')).toBeTruthy()
    expect(await screen.findByText('Criar um PRD')).toBeTruthy()
    expect(screen.getByText('Fazer um brainstorm')).toBeTruthy()
    const persona = screen.getByText('Conversar com John')
    expect(persona.closest('article')?.getAttribute('data-persona')).toBe('true')
  })

  // shortcut-customization: the hero's "Personalizar" entry + custom labels.
  it('shows the "Personalizar" pill when customization is wired, and opens it on click', async () => {
    const onCustomizeShortcuts = vi.fn()
    renderChat({}, { onCustomizeShortcuts })
    const pill = await screen.findByRole('button', { name: 'Personalizar atalhos' })
    fireEvent.click(pill)
    expect(onCustomizeShortcuts).toHaveBeenCalledTimes(1)
  })

  it('labels custom shortcuts via the pt-BR skill map, falling back to the catalog label', async () => {
    renderChat(
      {},
      {
        roleActions: [
          // Known skill key → pt-BR map wins over the carried label.
          {
            key: 'bmad-spec',
            kind: 'workflow',
            label: 'whatever-en',
            command: { key: 'bmad-spec', prompt: '/bmad-spec' }
          },
          // Unknown agent → "Conversar com <persona>" composed from the label.
          {
            key: 'bmad-agent-custom',
            kind: 'persona',
            label: 'Zoe',
            command: { key: 'bmad-agent-custom', prompt: '/bmad-agent-custom' }
          }
        ]
      }
    )
    expect(await screen.findByText('Criar uma spec')).toBeTruthy()
    const persona = screen.getByText('Conversar com Zoe')
    expect(persona.closest('article')?.getAttribute('data-persona')).toBe('true')
  })

  it('greets the user by first name when the profile has one', async () => {
    renderChat({}, { userName: 'Gustavo Bruno' })
    expect(screen.getByText('Olá Gustavo, o que você quer fazer hoje?')).toBeTruthy()
    expect(screen.queryByText('O que você quer fazer hoje?')).toBeNull()
  })

  it('falls back to the neutral greeting when the name is blank', async () => {
    renderChat({}, { userName: '   ' })
    expect(screen.getByText('O que você quer fazer hoje?')).toBeTruthy()
  })

  it('loads capabilities-driven model/effort options', async () => {
    renderChat()
    expect(await screen.findByText('Modelo A')).toBeTruthy()
    expect(screen.getByText('Baixo')).toBeTruthy()
  })

  // P0-011 (R-03): an adapter that advertises no model and no effort menus.
  // This is not a hypothetical edge — Chat.tsx's own comment names Devin and
  // Copilot as exactly this shape, and both are shipped agents. The composer
  // has to hide both pickers and keep the values null so they are omitted from
  // the turn, rather than sending an empty string the CLI will reject.
  it('hides the model and effort pickers for an adapter that advertises neither', async () => {
    renderChat({ capabilities: { models: [], efforts: [], supportsAttachments: true } })

    await screen.findByPlaceholderText('Escreva uma mensagem…')
    expect(screen.queryByText('Modelo A')).toBeNull()
    expect(screen.queryByText('Baixo')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'oi' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    const [, opts] = vi.mocked(window.hive.agent.send).mock.calls[0]
    expect((opts as { model?: unknown }).model ?? null).toBeNull()
    expect((opts as { effort?: unknown }).effort ?? null).toBeNull()
  })

  it('clicking a workflow action calls runWorkflow and renders a user message + a live turn meter', async () => {
    renderChat()
    const prd = await screen.findByText('Criar um PRD')
    fireEvent.click(prd.closest('article') as Element)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-prd', prompt: '/bmad-prd' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
    // The transcript shows the slash command that was invoked, verbatim.
    expect(await screen.findByText('/bmad-prd')).toBeTruthy()
    // chat-timing: the launched turn immediately reports a phase, where it
    // used to show only bouncing dots.
    expect(await screen.findByText('Iniciando')).toBeTruthy()
  })

  it('clicking the persona action launches its command', async () => {
    renderChat()
    const persona = await screen.findByText('Conversar com John')
    fireEvent.click(persona.closest('article') as Element)
    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
  })

  it('exposes launchAction via the imperative handle (used by the action rail)', async () => {
    mockHive()
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Criar um PRD')

    ref.current?.launchAction(roleActions[0])
    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-prd', prompt: '/bmad-prd' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
    expect(await screen.findByText('/bmad-prd')).toBeTruthy()
  })

  /**
   * A launched skill can carry the material it was launched with — the
   * ingestion sheet sends the staged path *and* the text. The transcript has
   * to show both, and has to make it obvious which half is the command: a
   * bare `/second-brain-ingest` with the user's notes nowhere on screen was
   * the reported defect.
   */
  describe('an invocation that carries material', () => {
    const ingest = (body: string): RoleAction => ({
      key: 'second-brain-ingest',
      kind: 'workflow',
      command: {
        key: 'second-brain-ingest',
        prompt: `/second-brain-ingest second-brain/raw/ingest-x.md\n\n${body}`
      }
    })

    async function launch(body: string): Promise<void> {
      mockHive()
      const ref = createRef<ChatHandle>()
      render(
        createElement(Chat, {
          workspace: '/ws',
          roleActions,
          agents: ['claude-cli'],
          defaultAgent: 'claude-cli',
          ref
        })
      )
      await screen.findByText('Criar um PRD')
      ref.current?.launchAction(ingest(body))
    }

    it('shows the command, its argument and the text as three distinct things', async () => {
      await launch('A squad decidiu migrar o billing.')

      expect(await screen.findByText('/second-brain-ingest')).toBeTruthy()
      expect(screen.getByText('second-brain/raw/ingest-x.md')).toBeTruthy()
      expect(screen.getByText('A squad decidiu migrar o billing.')).toBeTruthy()
    })

    it('leaves a short body fully expanded', async () => {
      await launch('Uma nota curta.')
      await screen.findByText('/second-brain-ingest')
      expect(screen.queryByText('Mostrar tudo')).toBeNull()
    })

    it('collapses a transcript-sized body behind a toggle, and expands it back', async () => {
      const long = 'Detalhe da reunião. '.repeat(60)
      await launch(long)

      const more = await screen.findByText('Mostrar tudo')
      const text = document.querySelector('.wb-invocation-text')
      expect(text?.hasAttribute('data-clamped')).toBe(true)

      fireEvent.click(more)
      expect(document.querySelector('.wb-invocation-text')?.hasAttribute('data-clamped')).toBe(
        false
      )
      expect(screen.getByText('Mostrar menos')).toBeTruthy()

      fireEvent.click(screen.getByText('Mostrar menos'))
      expect(document.querySelector('.wb-invocation-text')?.hasAttribute('data-clamped')).toBe(true)
    })
  })

  // skill-studio: launchCreation opens a *fresh* conversation (the prior
  // command leaves the pane) and overrides the model/effort for that turn.
  it('exposes launchCreation, which opens a new conversation with a per-turn model override', async () => {
    mockHive()
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Criar um PRD')

    // Seed a conversation, then launch a creation over it.
    ref.current?.launchAction(roleActions[0])
    expect(await screen.findByText('/bmad-prd')).toBeTruthy()

    ref.current?.launchCreation(
      {
        key: 'bmad-workflow-builder',
        kind: 'workflow',
        command: { key: 'bmad-workflow-builder', prompt: '/bmad-workflow-builder' }
      },
      { model: 'model-b', effort: 'low' }
    )

    expect(window.hive.agent.runWorkflow).toHaveBeenLastCalledWith(
      { key: 'bmad-workflow-builder', prompt: '/bmad-workflow-builder' },
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        model: 'model-b',
        effort: 'low'
      })
    )
    // Fresh conversation: the builder command is on screen, the prior one is gone.
    expect(await screen.findByText('/bmad-workflow-builder')).toBeTruthy()
    expect(screen.queryByText('/bmad-prd')).toBeNull()
  })

  it('starts the conversation agent session bound to the workspace', async () => {
    const { startCalls } = renderChat()
    await waitFor(() =>
      expect(startCalls).toContainEqual({ agentId: 'claude-cli', workspace: '/ws' })
    )
  })

  it('sends a message: user ChatMessage + agent.send', async () => {
    renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'Olá, agente' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(await screen.findByText('Olá, agente')).toBeTruthy()
    expect(window.hive.agent.send).toHaveBeenCalledWith(
      'Olá, agente',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String)
      })
    )
  })

  it('streams token events, then finalizes on done', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    emit({ type: 'token', text: 'Olá' })
    expect(await screen.findByText('Olá')).toBeTruthy()
    emit({ type: 'token', text: ' mundo' })
    expect(await screen.findByText('Olá mundo')).toBeTruthy()
    emit({ type: 'done' })
    expect(await screen.findByText('Olá mundo')).toBeTruthy()
  })

  it('shows an error Alert on an error event', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    emit({ type: 'token', text: 'partial' })
    await screen.findByText('partial')
    emit({ type: 'error', message: 'boom' })
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  // chat-controls CC-R1 — interrupt. `interrupt` (not `stop`): stopping the
  // turn must keep the session alive for the conversation's next message.
  it('shows the Stop control only while streaming and calls agent.interrupt when clicked', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    expect(screen.queryByLabelText('Interromper a resposta do agente')).toBeNull()

    emit({ type: 'token', text: 'thinking' })
    const stop = await screen.findByLabelText('Interromper a resposta do agente')
    fireEvent.click(stop)
    expect(window.hive.agent.interrupt).toHaveBeenCalled()
    expect(window.hive.agent.stop).not.toHaveBeenCalled()
  })

  it('an interrupted event keeps partial output as a finished message (no error Alert)', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    emit({ type: 'token', text: 'partial answer' })
    await screen.findByText('partial answer')
    emit({ type: 'interrupted' })

    // Partial preserved, the live meter settled into a receipt, no error.
    expect(await screen.findByText('partial answer')).toBeTruthy()
    expect(screen.queryByText('Pensando')).toBeNull()
    expect(screen.getByText(/^Interrompido após/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an interrupted event with no output leaves no empty assistant bubble', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.click(screen.getByText('Enviar')) // empty send is a no-op path guard
    emit({ type: 'interrupted' })
    // Only structural nodes; no assistant message rendered.
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  // agent-selection AG-R3.3 — active-agent indicator.
  it('shows the active agent in the composer switcher', async () => {
    renderChat()
    // The switcher renders the conversation's agent (trigger; the mocked
    // dropdown also renders its menu items, so there may be more than one).
    const names = await screen.findAllByText('Claude Code')
    expect(names.length).toBeGreaterThan(0)
  })

  // chat-controls CC-R2 — slash menu (rows are just the command, `/bmad-*`).
  it('opens the slash menu on a leading "/" listing workspace skills, and filters', async () => {
    renderChat({
      skills: [
        { key: 'bmad-prd', label: 'Create PRD', description: 'PRD workflow' },
        { key: 'bmad-ux', label: 'Create UX', description: 'UX spec' }
      ]
    })
    await screen.findByText('Modelo A')

    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    expect(await screen.findByText('/bmad-prd')).toBeTruthy()
    expect(screen.getByText('/bmad-ux')).toBeTruthy()
    // Compact rows: the command only — no title/description pair.
    expect(screen.queryByText('Create PRD')).toBeNull()
    expect(screen.queryByText('PRD workflow')).toBeNull()

    fireEvent.change(input, { target: { value: '/ux' } })
    await waitFor(() => expect(screen.queryByText('/bmad-prd')).toBeNull())
    expect(screen.getByText('/bmad-ux')).toBeTruthy()
  })

  it('selecting a slash skill launches it as a workflow and clears the composer', async () => {
    renderChat({ skills: [{ key: 'bmad-ux', label: 'Create UX', description: 'UX spec' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…') as HTMLInputElement
    fireEvent.change(input, { target: { value: '/ux' } })

    const option = await screen.findByText('/bmad-ux')
    fireEvent.mouseDown(option)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-ux', prompt: '/bmad-ux' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
  })

  it('keyboard-navigates the slash menu (ArrowDown + Enter selects)', async () => {
    renderChat({
      skills: [
        { key: 'bmad-prd', label: 'Create PRD', description: '' },
        { key: 'bmad-ux', label: 'Create UX', description: '' }
      ]
    })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    await screen.findByText('/bmad-prd')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-ux', prompt: '/bmad-ux' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
  })

  it('shows a teaching empty state when no skills are installed', async () => {
    renderChat({ skills: [] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    expect(await screen.findByText('Nenhum comando disponível neste workspace.')).toBeTruthy()
  })

  // P2-002: the two empty states are different diagnoses and must not collapse
  // into one. "Nothing installed" tells the user to provision the workspace;
  // "nothing matched" tells them the skill they typed was never discovered —
  // reading the first when the catalogue is fine would send them to fix a
  // workspace that has no problem.
  it('a query matching no installed skill reads as "no match", not "nothing installed"', async () => {
    renderChat({ skills: [{ key: 'bmad-prd', label: 'Create PRD', description: '' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')

    fireEvent.change(input, { target: { value: '/naoexiste' } })

    expect(await screen.findByText('Nenhum comando encontrado.')).toBeTruthy()
    expect(screen.queryByText('Nenhum comando disponível neste workspace.')).toBeNull()
    expect(screen.queryByText('/bmad-prd')).toBeNull()
  })

  it('an undiscovered skill leaves nothing selectable — Enter does not launch a turn', async () => {
    renderChat({ skills: [{ key: 'bmad-prd', label: 'Create PRD', description: '' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/naoexiste' } })
    await screen.findByText('Nenhum comando encontrado.')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.hive.agent.runWorkflow).not.toHaveBeenCalled()
  })

  it('the mention menu says so when the workspace has no files at all', async () => {
    renderChat({ workspaceFiles: [] })
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'veja #' }
    })

    expect(await screen.findByText('Nenhum arquivo encontrado no workspace.')).toBeTruthy()
    expect(screen.queryByText('Nenhum arquivo corresponde à busca.')).toBeNull()
  })

  it('the mention menu reads as "no match" when the workspace has files but none match', async () => {
    renderChat({ workspaceFiles: ['README.md'] })
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'veja #naoexiste' }
    })

    expect(await screen.findByText('Nenhum arquivo corresponde à busca.')).toBeTruthy()
    expect(screen.queryByText('Nenhum arquivo encontrado no workspace.')).toBeNull()
  })

  // chat-attachments — `#` workspace-file references.
  it('opens the file mention menu on # listing workspace files, and filters', async () => {
    renderChat({ workspaceFiles: ['README.md', 'docs/prd.md'] })
    await screen.findByText('Modelo A')

    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: 'veja #' } })
    expect(await screen.findByText('README.md')).toBeTruthy()
    expect(screen.getByText('prd.md')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'veja #prd' } })
    await waitFor(() => expect(screen.queryByText('README.md')).toBeNull())
    expect(screen.getByText('prd.md')).toBeTruthy()
  })

  it('selecting a mention inserts the #path token and closes the menu', async () => {
    renderChat({ workspaceFiles: ['docs/prd.md'] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'resuma #prd' } })

    const option = await screen.findByText('prd.md')
    fireEvent.mouseDown(option)

    await waitFor(() => expect(input.value).toBe('resuma #docs/prd.md '))
    expect(screen.queryByText('Arquivos do workspace')).toBeNull()
  })

  it('keyboard-selects a mention (Enter inserts the highlighted file)', async () => {
    renderChat({ workspaceFiles: ['docs/prd.md', 'README.md'] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: '#' } })
    await screen.findByText('prd.md')

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.value.startsWith('#')).toBe(true))
    // Enter inserted a token instead of submitting.
    expect(window.hive.agent.send).not.toHaveBeenCalled()
  })

  it('sending a message with a valid #referência passes it to agent.send as attachments', async () => {
    renderChat({ workspaceFiles: ['docs/prd.md'] })
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'resuma #docs/prd.md por favor' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenCalledWith(
      'resuma #docs/prd.md por favor',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        attachments: ['docs/prd.md']
      })
    )
  })

  // chat-attachments — attached files.
  it('the attach button picks files, renders removable chips, and sends their paths', async () => {
    const { chatHistory } = renderChat({
      pickedAttachments: [{ path: '/abs/relatorio.pdf', name: 'relatorio.pdf', size: 2048 }]
    })
    await screen.findByText('Modelo A')

    fireEvent.click(screen.getByLabelText('Anexar arquivos'))
    expect(await screen.findByText('relatorio.pdf')).toBeTruthy()
    expect(screen.getByText('2,0 KB')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'analisa isso' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenCalledWith(
      'analisa isso',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        attachments: ['/abs/relatorio.pdf']
      })
    )
    // The sent bubble keeps the file as a chip, and the persisted user turn
    // carries the attachment names.
    expect(await screen.findByText('relatorio.pdf')).toBeTruthy()
    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'user',
        text: 'analisa isso',
        attachments: ['relatorio.pdf']
      })
    )
  })

  it('removing an attachment chip drops it from the pending send', async () => {
    renderChat({
      pickedAttachments: [{ path: '/abs/relatorio.pdf', name: 'relatorio.pdf', size: 2048 }]
    })
    await screen.findByText('Modelo A')

    fireEvent.click(screen.getByLabelText('Anexar arquivos'))
    await screen.findByText('relatorio.pdf')
    fireEvent.click(screen.getByLabelText('Remover anexo relatorio.pdf'))
    await waitFor(() => expect(screen.queryByText('relatorio.pdf')).toBeNull())
  })

  it('dropping explorer-tree workspace files onto the composer adds chips and sends relative paths', async () => {
    renderChat({ workspaceFiles: ['docs/prd.md'] })
    await screen.findByText('Modelo A')

    const wrap = document.querySelector('.wb-composer-wrap') as HTMLElement
    fireEvent.drop(wrap, {
      dataTransfer: {
        types: ['application/x-hive-workspace-file'],
        getData: () => JSON.stringify(['docs/prd.md']),
        files: []
      }
    })

    expect(await screen.findByText('prd.md')).toBeTruthy()
    expect(screen.getByText('docs')).toBeTruthy() // parent-folder meta, not a size

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'resuma' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenCalledWith(
      'resuma',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        attachments: ['docs/prd.md']
      })
    )
  })

  // P0-011 (R-03): the drop test above uses a nested path, so the chip's
  // "which folder is this in?" caption only ever took its nested arm. A file
  // at the workspace root has no parent to name — rendering an empty caption
  // line, or falling through to the file-size branch (size is 0 for a
  // workspace drop, so it would read "0 B"), is the visible failure.
  it('a dropped root-level file shows its name with no parent-folder caption', async () => {
    renderChat({ workspaceFiles: ['README.md'] })
    await screen.findByText('Modelo A')

    const wrap = document.querySelector('.wb-composer-wrap') as HTMLElement
    fireEvent.drop(wrap, {
      dataTransfer: {
        types: ['application/x-hive-workspace-file'],
        getData: () => JSON.stringify(['README.md']),
        files: []
      }
    })

    const chip = (await screen.findByText('README.md')).closest('.wb-composer-chip') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.textContent).toContain('README.md')
    // No size fallback leaking in where a folder name would go.
    expect(chip.textContent).not.toContain('B')
  })

  it('a dropped workspace chip and its typed #reference dedupe into one context file', async () => {
    renderChat({ workspaceFiles: ['docs/prd.md'] })
    await screen.findByText('Modelo A')

    const wrap = document.querySelector('.wb-composer-wrap') as HTMLElement
    fireEvent.drop(wrap, {
      dataTransfer: {
        types: ['application/x-hive-workspace-file'],
        getData: () => JSON.stringify(['docs/prd.md']),
        files: []
      }
    })
    await screen.findByText('prd.md')

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'resuma #docs/prd.md agora' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenCalledWith(
      'resuma #docs/prd.md agora',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        attachments: ['docs/prd.md']
      })
    )
  })

  it('attachments alone (no text) are sendable', async () => {
    renderChat({
      pickedAttachments: [{ path: '/abs/dados.csv', name: 'dados.csv', size: 100 }]
    })
    await screen.findByText('Modelo A')

    fireEvent.click(screen.getByLabelText('Anexar arquivos'))
    await screen.findByText('dados.csv')
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String),
        attachments: ['/abs/dados.csv']
      })
    )
  })

  it('ignores tool events (no crash, no message)', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    expect(() => emit({ type: 'tool' })).not.toThrow()
  })

  it('ArrowUp wraps to the last slash option', async () => {
    renderChat({
      skills: [
        { key: 'bmad-prd', label: 'Create PRD', description: '' },
        { key: 'bmad-ux', label: 'Create UX', description: '' }
      ]
    })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    await screen.findByText('/bmad-prd')

    fireEvent.keyDown(input, { key: 'ArrowUp' }) // wraps from 0 to last (index 1)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-ux', prompt: '/bmad-ux' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
  })

  it('closes the slash menu on Escape', async () => {
    renderChat({ skills: [{ key: 'bmad-ux', label: 'Create UX', description: '' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    await screen.findByText('/bmad-ux')

    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('/bmad-ux')).toBeNull())
  })

  // session-history — persisted conversations.
  it('persists the first sent message by creating a session and appending the user turn', async () => {
    const { chatHistory } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'Olá, agente' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(chatHistory.create).toHaveBeenCalledWith('/ws', 'claude-cli'))
    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'user',
        text: 'Olá, agente'
      })
    )
  })

  it('reuses the same session for the second message (create called once)', async () => {
    const { chatHistory, emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'primeira' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    act(() => emit({ type: 'done' }))
    // Re-query: the hero → conversation transition remounts the composer, and
    // (since chat-queue) the placeholder is the busy one until the turn ends.
    fireEvent.change(await screen.findByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'segunda' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'user',
        text: 'segunda'
      })
    )
    expect(chatHistory.create).toHaveBeenCalledTimes(1)
  })

  it("persists the assistant's reply into the session on done", async () => {
    const { chatHistory, emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(chatHistory.create).toHaveBeenCalled())

    emit({ type: 'token', text: 'resposta ' })
    emit({ type: 'token', text: 'completa' })
    emit({ type: 'done' })

    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'assistant',
        text: 'resposta completa'
      })
    )
  })

  it('persists the partial reply when the turn is interrupted', async () => {
    const { chatHistory, emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(chatHistory.create).toHaveBeenCalled())

    emit({ type: 'token', text: 'parcial' })
    emit({ type: 'interrupted' })

    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'assistant',
        text: 'parcial'
      })
    )
  })

  it('offers recent conversations on the hero and restores one on click', async () => {
    const meta: SessionMetaLike = {
      id: 'session-9',
      title: 'PRD do app de finanças',
      createdAt: Date.now() - 3_600_000,
      updatedAt: Date.now() - 3_600_000,
      messageCount: 2,
      agent: 'claude-cli',
      preview: 'último trecho'
    }
    renderChat({
      recentSessions: [meta],
      storedSession: {
        id: 'session-9',
        workspace: '/ws',
        agent: 'claude-cli',
        title: 'PRD do app de finanças',
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        messages: [
          { id: 'm1', role: 'user', text: 'pergunta antiga', at: meta.createdAt },
          { id: 'm2', role: 'assistant', text: 'resposta antiga', at: meta.updatedAt }
        ]
      }
    })

    expect(await screen.findByText('Continuar de onde parou')).toBeTruthy()
    fireEvent.click(await screen.findByText('PRD do app de finanças'))

    expect(await screen.findByText('pergunta antiga')).toBeTruthy()
    expect(screen.getByText('resposta antiga')).toBeTruthy()
    expect(window.hive.chatHistory.get).toHaveBeenCalledWith('/ws', 'session-9')
  })

  it('newConversation (handle) clears the transcript back to the hero', async () => {
    mockHive()
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'alguma coisa' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    await screen.findByText('alguma coisa')

    await act(async () => {
      ref.current?.newConversation()
    })
    expect(await screen.findByText('O que você quer fazer hoje?')).toBeTruthy()
  })

  it('openSession (handle) restores a stored transcript and reports it via onSessionChange', async () => {
    const stored: StoredSessionLike = {
      id: 'session-7',
      workspace: '/ws',
      agent: 'claude-cli',
      title: 'Arquitetura do serviço',
      createdAt: 10,
      updatedAt: 20,
      messages: [{ id: 'm1', role: 'user', text: 'como ficou a arquitetura?', at: 10 }]
    }
    mockHive({ storedSession: stored })
    const ref = createRef<ChatHandle>()
    const onSessionChange = vi.fn()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        onSessionChange,
        ref
      })
    )
    await screen.findByText('Modelo A')

    await act(async () => {
      await ref.current?.openSession('session-7')
    })

    expect(await screen.findByText('como ficou a arquitetura?')).toBeTruthy()
    expect(onSessionChange).toHaveBeenLastCalledWith('session-7')
  })

  // background-turns: switching away must NOT stop the agent — the turn
  // keeps streaming in the background and its reply lands in its own
  // conversation.
  it('switching away mid-stream keeps the turn running: no interrupt, reply completes into ITS conversation', async () => {
    const { chatHistory, emit } = mockHive()
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta longa' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(chatHistory.create).toHaveBeenCalled())
    emit({ type: 'token', text: 'resposta em andamento' })
    await screen.findByText('resposta em andamento')

    // Switch to a fresh conversation mid-stream: the turn detaches from the
    // pane but is NOT interrupted…
    await act(async () => {
      ref.current?.newConversation()
    })
    expect(await screen.findByText('O que você quer fazer hoje?')).toBeTruthy()
    expect(window.hive.agent.interrupt).not.toHaveBeenCalled()
    expect(screen.queryByText('resposta em andamento')).toBeNull()

    // …its stream keeps buffering silently and, on done, the FULL reply
    // persists into the conversation it belongs to. Pane stays clean.
    await act(async () => {
      emit({ type: 'token', text: ' e concluída' })
      emit({ type: 'done' })
    })
    await waitFor(() =>
      expect(chatHistory.append).toHaveBeenCalledWith('/ws', 'session-1', {
        role: 'assistant',
        text: 'resposta em andamento e concluída'
      })
    )
    expect(screen.queryByText(/resposta em andamento/)).toBeNull()
  })

  it('returning to a conversation with a running turn re-attaches its live stream', async () => {
    const { chatHistory, emit } = mockHive({
      storedSession: {
        id: 'session-1',
        workspace: '/ws',
        agent: 'claude-cli',
        title: 'pergunta longa',
        createdAt: 1,
        updatedAt: 2,
        messages: [{ id: 'm1', role: 'user', text: 'pergunta longa', at: 1 }]
      }
    })
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta longa' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(chatHistory.create).toHaveBeenCalled())
    emit({ type: 'token', text: 'parcial em background' })
    await screen.findByText('parcial em background')

    // Leave…
    await act(async () => {
      ref.current?.newConversation()
    })
    expect(screen.queryByText('parcial em background')).toBeNull()

    // …and come back: the live stream re-attaches exactly where it is…
    await act(async () => {
      await ref.current?.openSession('session-1')
    })
    expect(await screen.findByText('parcial em background')).toBeTruthy()

    // …and keeps streaming on screen.
    await act(async () => {
      emit({ type: 'token', text: ' que continua' })
    })
    expect(await screen.findByText('parcial em background que continua')).toBeTruthy()
  })

  it('Stop interrupts only the on-screen turn, passing its turn id', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    const sentOpts = vi.mocked(window.hive.agent.send).mock.calls[0][1] as { turnId?: string }
    emit({ type: 'token', text: 'pensando', turnId: sentOpts.turnId } as never)

    const stop = await screen.findByLabelText('Interromper a resposta do agente')
    fireEvent.click(stop)
    expect(window.hive.agent.interrupt).toHaveBeenCalledWith(sentOpts.turnId)
  })

  it('reports conversations with a running turn via onRunningSessionsChange', async () => {
    mockHive()
    const onRunningSessionsChange = vi.fn()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        onRunningSessionsChange
      })
    )
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(onRunningSessionsChange).toHaveBeenLastCalledWith(['session-1']))
  })

  // session-history — conversation memory (--resume via the session event).
  it("a session event persists the CLI id into the turn's conversation and the next send resumes it", async () => {
    const { chatHistory, emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'primeira pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    // First turn starts with no resume handle.
    expect(window.hive.agent.send).toHaveBeenLastCalledWith(
      'primeira pergunta',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String)
      })
    )

    await act(async () => {
      emit({ type: 'session', id: 'cli-sess-42' })
      emit({ type: 'token', text: 'resposta' })
      emit({ type: 'done' })
    })
    await waitFor(() =>
      expect(chatHistory.setCliSession).toHaveBeenCalledWith('/ws', 'session-1', 'cli-sess-42')
    )

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'segunda pergunta' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    expect(window.hive.agent.send).toHaveBeenLastCalledWith(
      'segunda pergunta',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: 'cli-sess-42',
        turnId: expect.any(String)
      })
    )
  })

  it('openSession restores the stored CLI id so the next turn resumes that conversation', async () => {
    mockHive({
      storedSession: {
        id: 'session-7',
        workspace: '/ws',
        agent: 'claude-cli',
        title: 'Antiga',
        createdAt: 10,
        updatedAt: 20,
        messages: [{ id: 'm1', role: 'user', text: 'contexto antigo', at: 10 }],
        cliSessionId: 'cli-sess-77'
      }
    })
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Modelo A')

    await act(async () => {
      await ref.current?.openSession('session-7')
    })
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'continuando' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenLastCalledWith(
      'continuando',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: 'cli-sess-77',
        turnId: expect.any(String)
      })
    )
  })

  it('newConversation clears the resume handle (a fresh conversation never inherits context)', async () => {
    mockHive({
      storedSession: {
        id: 'session-7',
        workspace: '/ws',
        agent: 'claude-cli',
        title: 'Antiga',
        createdAt: 10,
        updatedAt: 20,
        messages: [{ id: 'm1', role: 'user', text: 'contexto antigo', at: 10 }],
        cliSessionId: 'cli-sess-77'
      }
    })
    const ref = createRef<ChatHandle>()
    render(
      createElement(Chat, {
        workspace: '/ws',
        roleActions,
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        ref
      })
    )
    await screen.findByText('Modelo A')
    await act(async () => {
      await ref.current?.openSession('session-7')
    })

    await act(async () => {
      ref.current?.newConversation()
    })
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'do zero' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(window.hive.agent.send).toHaveBeenLastCalledWith(
      'do zero',
      expect.objectContaining({
        agentId: 'claude-cli',
        resume: null,
        turnId: expect.any(String)
      })
    )
  })

  // Agent Change Review (M11, T16): a change card renders in the transcript for
  // a turn that touched files, when Chat is inside a ReviewProvider.
  it('renders an in-chat change card for a pending turn (ACR-R2.2)', async () => {
    mockHive({})
    const store: ReviewStore = {
      workspace: '/ws',
      changes: [
        {
          path: 'src/a.txt',
          status: 'modified',
          diff: { hunks: [], binary: false },
          adds: 3,
          dels: 1
        }
      ],
      turns: [{ turnId: 't1', at: 1, paths: ['src/a.txt'] }],
      pendingCount: 1,
      byStatus: {
        created: [],
        modified: [
          {
            path: 'src/a.txt',
            status: 'modified',
            diff: { hunks: [], binary: false },
            adds: 3,
            dels: 1
          }
        ],
        deleted: []
      },
      isStale: false,
      refresh: vi.fn(),
      acceptFile: vi.fn(async () => ({ ok: true })),
      acceptFiles: vi.fn(async () => ({ ok: true })),
      rejectFiles: vi.fn(async () => ({ ok: true })),
      rejectFile: vi.fn(async () => ({ ok: true })),
      acceptHunk: vi.fn(async () => ({ ok: true })),
      rejectHunk: vi.fn(async () => ({ ok: true })),
      acceptAll: vi.fn(async () => ({ ok: true })),
      rejectAll: vi.fn(async () => ({ ok: true })),
      staleConflict: null,
      resolveStale: vi.fn(async () => {})
    }
    render(
      createElement(
        ReviewProvider,
        { store },
        createElement(Chat, {
          workspace: '/ws',
          roleActions: [],
          agents: ['claude-cli'],
          defaultAgent: 'claude-cli',
          onCustomizeShortcuts: vi.fn()
        })
      )
    )
    // Send a message so the transcript (not the empty hero) renders — the card
    // lives in the message list.
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'refatore os arquivos' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(await screen.findByText('Editei 1 arquivo')).toBeTruthy()
    expect(screen.getByText('a.txt')).toBeTruthy()
  })

  // --- agent-activity: the live "what the agent is doing" feed --------------

  it("narrates the agent's tool calls while it works, and the meter follows the phase", async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'organize o vault' }
    })
    fireEvent.click(screen.getByText('Enviar'))
    // Before any tool runs, the turn has only just been handed over.
    expect(await screen.findByText('Iniciando')).toBeTruthy()

    act(() => {
      emit({
        type: 'tool',
        name: 'Read',
        detail: '/ws/docs/prd.md',
        toolId: 'tu-1',
        phase: 'start'
      })
    })
    expect(await screen.findByText('Lendo')).toBeTruthy()
    expect(screen.getByText('docs/prd.md')).toBeTruthy()
    // chat-timing: the phase is read off the timeline, so a running step
    // moves the meter from "starting" to "executing" with no separate state.
    expect(screen.getByText('Executando')).toBeTruthy()
    expect(screen.queryByText('Iniciando')).toBeNull()

    act(() => {
      emit({ type: 'tool', name: '', toolId: 'tu-1', phase: 'end', ok: true })
      emit({ type: 'tool', name: 'Bash', detail: 'npm test', toolId: 'tu-2', phase: 'start' })
    })
    expect(await screen.findByText('Rodando')).toBeTruthy()
    expect(screen.getByText('npm test')).toBeTruthy()
  })

  it("keeps the turn's steps in the transcript after it finishes, with none left spinning", async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'edite o arquivo' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      emit({ type: 'tool', name: 'Edit', detail: '/ws/src/a.ts', toolId: 'tu-1', phase: 'start' })
      emit({ type: 'token', text: 'pronto' })
      emit({ type: 'done' })
    })

    expect(await screen.findByText('pronto')).toBeTruthy()
    // The turn ended without a `tool_result`, so the row settles rather than
    // spinning forever — and it says so in the past tense, which is the one
    // state channel that survives a screenshot and a screen reader.
    const row = screen.getByText('Editou').closest('li')
    expect(row?.getAttribute('data-state')).toBe('ok')
  })

  // --- agent-approvals: the prompt that used to appear nowhere --------------

  it('surfaces a blocked permission request as a decision the user can actually answer', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'crie o vault' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({
        type: 'approval',
        requestId: 'req-1',
        tool: 'Bash',
        detail: 'mkdir -p ~/vault',
        input: { command: 'mkdir -p ~/vault', description: 'Cria o vault' }
      })
    })

    expect(await screen.findByText('Rodar um comando no terminal')).toBeTruthy()
    // The literal command is shown, never summarized — a command the user
    // can't read is a command they can't consent to.
    expect(screen.getByText('mkdir -p ~/vault')).toBeTruthy()

    fireEvent.click(screen.getByText('Permitir'))
    expect(window.hive.agent.respondApproval).toHaveBeenCalledWith('req-1', {
      behavior: 'allow',
      scope: 'once',
      message: undefined
    })
    // The card stays as the record of what was authorized.
    expect(await screen.findByText('Permitido')).toBeTruthy()
    expect(screen.queryByText('Permitir')).toBeNull()
  })

  it('records a standing grant on "Sempre permitir", and a refusal carries a reason back to the agent', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'busque na web' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({
        type: 'approval',
        requestId: 'req-a',
        tool: 'WebFetch',
        detail: 'https://example.dev'
      })
    })
    fireEvent.click(await screen.findByText('Sempre permitir'))
    expect(window.hive.agent.respondApproval).toHaveBeenCalledWith('req-a', {
      behavior: 'allow',
      scope: 'always',
      message: undefined
    })
    expect(await screen.findByText('Permitido sempre')).toBeTruthy()

    act(() => {
      hive.emit({ type: 'approval', requestId: 'req-b', tool: 'Bash', detail: 'rm -rf /' })
    })
    fireEvent.click(await screen.findByText('Recusar'))
    expect(window.hive.agent.respondApproval).toHaveBeenCalledWith('req-b', {
      behavior: 'deny',
      scope: 'once',
      message: 'Recusado pelo usuário no Hive Desktop.'
    })
    expect(await screen.findByText('Recusado')).toBeTruthy()
  })

  it('Esc refuses a pending request, so the blocked turn is always answerable from the keyboard', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'rode algo' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({ type: 'approval', requestId: 'req-esc', tool: 'Bash', detail: 'ls' })
    })
    const card = (await screen.findByText('Rodar um comando no terminal')).closest(
      '[role="group"]'
    ) as HTMLElement
    fireEvent.keyDown(card, { key: 'Escape' })

    expect(window.hive.agent.respondApproval).toHaveBeenCalledWith(
      'req-esc',
      expect.objectContaining({ behavior: 'deny' })
    )
  })

  // --- the transcript is a log, not three slabs -----------------------------

  it('renders a turn in the order it happened: prose, then the ask, then the work', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'crie a pasta' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({ type: 'token', text: 'Vou criar a pasta.' })
      hive.emit({ type: 'approval', requestId: 'req-order', tool: 'Bash', detail: 'mkdir out' })
      hive.emit({ type: 'tool', name: 'Bash', detail: 'mkdir out', toolId: 't1', phase: 'start' })
      hive.emit({ type: 'tool', name: '', toolId: 't1', phase: 'end', ok: true })
      hive.emit({ type: 'token', text: ' Pronto.' })
      hive.emit({ type: 'done' })
    })

    const turn = (await screen.findByText('Vou criar a pasta.')).closest('.wb-turn') as HTMLElement
    // Walk the rendered nodes and record which kind of block each one is. The
    // regression this pins: the ask used to be pinned to the bottom of the
    // whole conversation and the command hoisted above the sentence that
    // explained it, so a turn could never be read as the story it tells.
    const kinds = [...turn.children].map((node) =>
      node.classList.contains('wb-approval') || node.classList.contains('wb-approval-note')
        ? 'ask'
        : node.classList.contains('wb-activity')
          ? 'work'
          : node.classList.contains('wb-turn-meter')
            ? 'meter'
            : 'prose'
    )
    // The meter closes the turn, after everything it is reporting on.
    expect(kinds).toEqual(['prose', 'ask', 'work', 'prose', 'meter'])
    // And the prose is two separate blocks, not one run reflowed around the
    // step — the second sentence belongs after the command, where it was said.
    expect(screen.getByText('Pronto.')).toBeTruthy()
  })

  it('answers a permission card that already settled into the transcript', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'rode algo' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({
        type: 'approval',
        requestId: 'req-late',
        tool: 'WebFetch',
        detail: 'https://x.dev'
      })
    })
    await screen.findByText('Acessar um endereço na web')
    fireEvent.click(screen.getByText('Permitir'))

    // The card stays where it was asked, carrying its verdict, rather than
    // disappearing or drifting to the foot of the conversation.
    expect(await screen.findByText('Permitido')).toBeTruthy()
    expect(window.hive.agent.respondApproval).toHaveBeenCalledWith('req-late', {
      behavior: 'allow',
      scope: 'once',
      message: undefined
    })
  })

  it('a stopped turn leaves no permission looking answerable', async () => {
    const hive = renderChat()
    await screen.findByText('Modelo A')
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'rode algo' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    act(() => {
      hive.emit({ type: 'approval', requestId: 'req-dead', tool: 'Bash', detail: 'ls' })
      hive.emit({ type: 'interrupted' })
    })

    // main already denied it on the interrupt; the card must agree instead of
    // offering buttons that answer a process that is gone.
    expect(await screen.findByText('Recusado')).toBeTruthy()
    expect(screen.queryByText('Permitir')).toBeNull()
  })

  // ── voice-prompt (M13) ────────────────────────────────────────────────────
  describe('dictation in the composer', () => {
    // The fakes are module-level, so a previous test's teardown (which stops
    // the capture on unmount) would otherwise be counted by the next one.
    beforeEach(() => {
      capture.reset()
      whisper.calls = 0
    })

    /** Starts a take and speaks one phrase followed by a real pause. */
    async function speak(): Promise<void> {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Ditar' }))
      })
      await act(async () => {
        // The room first: this is what seeds the segmenter's noise floor.
        capture.emit(100, 0.002)
        capture.emit(2500, 0.4)
        capture.emit(800, 0.002)
      })
    }

    function composer(): HTMLInputElement {
      return screen.getByPlaceholderText('Escreva uma mensagem…') as HTMLInputElement
    }

    it('shows a quiet mic control in the toolbar, unpressed (VP-R1.1)', async () => {
      renderChat()
      const mic = await screen.findByRole('button', { name: 'Ditar' })
      expect(mic.getAttribute('aria-pressed')).toBe('false')
      // Same visual weight as the attach control — never an accent-filled CTA.
      expect(mic.classList.contains('wb-attach-btn')).toBe(true)
    })

    it('puts the composer into dictation mode in place (VP-R1.2)', async () => {
      renderChat()
      const mic = await screen.findByRole('button', { name: 'Ditar' })
      await act(async () => {
        fireEvent.click(mic)
      })

      // The transport replaced the toolbar cluster, the frame took the ring…
      expect(document.body.querySelector('[data-highlighted="true"]')).toBeTruthy()
      // …and the paperclip is gone with the cluster it lived in.
      expect(screen.queryByRole('button', { name: 'Anexar arquivo' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Concluir' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy()
    })

    it('lands the transcribed phrase at the caret, joined to what was typed', async () => {
      renderChat()
      await screen.findByRole('button', { name: 'Ditar' })
      fireEvent.change(composer(), { target: { value: 'revisa o ' } })
      await speak()

      await waitFor(() => {
        expect(composer().value).toBe('revisa o arquivo de configuração')
      })
      // Capture continues — the phrase arrived while the take is still live.
      expect(capture.state.stopped).toBe(0)
    })

    it('restores the exact draft when Esc discards the take (VP-R1.5, D-VP-9)', async () => {
      renderChat()
      await screen.findByRole('button', { name: 'Ditar' })
      fireEvent.change(composer(), { target: { value: 'revisa o ' } })
      await speak()
      await waitFor(() => {
        expect(composer().value).toBe('revisa o arquivo de configuração')
      })

      await act(async () => {
        fireEvent.keyDown(composer(), { key: 'Escape' })
      })

      expect(composer().value).toBe('revisa o ')
      expect(capture.state.stopped).toBe(1)
      // Back to the ordinary toolbar.
      expect(screen.getByRole('button', { name: 'Ditar' }).getAttribute('aria-pressed')).toBe(
        'false'
      )
    })

    it('finalizes before sending, never a half-transcribed prompt (VP-R1.6)', async () => {
      renderChat()
      await screen.findByRole('button', { name: 'Ditar' })
      await speak()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
      })

      await waitFor(() => {
        expect(window.hive.agent.send).toHaveBeenCalled()
      })
      // What was sent is the transcript, not the empty value the send saw.
      const [sent] = vi.mocked(window.hive.agent.send).mock.calls[0]
      expect(sent).toContain('Arquivo de configuração')
      expect(capture.state.stopped).toBe(1)
    })

    it('toggles with the composer shortcut, concluding rather than discarding', async () => {
      renderChat()
      await screen.findByRole('button', { name: 'Ditar' })
      fireEvent.change(composer(), { target: { value: 'antes ' } })

      await act(async () => {
        fireEvent.keyDown(composer(), { key: 'D', ctrlKey: true, shiftKey: true })
      })
      expect(screen.getByRole('button', { name: 'Concluir' })).toBeTruthy()

      await act(async () => {
        capture.emit(100, 0.002)
        capture.emit(2500, 0.4)
      })
      await act(async () => {
        fireEvent.keyDown(composer(), { key: 'D', ctrlKey: true, shiftKey: true })
      })

      // Concluded: the take's text is kept, unlike Esc.
      await waitFor(() => {
        expect(composer().value).toContain('arquivo de configuração')
      })
    })

    it('warms the engine on intent, and not before (D-VP-6)', async () => {
      renderChat()
      const mic = await screen.findByRole('button', { name: 'Ditar' })
      whisper.calls = 0

      fireEvent.pointerEnter(mic)
      await waitFor(() => {
        expect(whisper.calls).toBe(1)
      })
      // Hovering again costs nothing.
      fireEvent.pointerEnter(mic)
      expect(whisper.calls).toBe(1)
    })

    it('explains a refused microphone and leaves the draft untouched (VP-R4.3)', async () => {
      renderChat()
      await screen.findByRole('button', { name: 'Ditar' })
      fireEvent.change(composer(), { target: { value: 'meu rascunho' } })
      capture.state.fail = new (await import('../dictation/micCapture')).CaptureFailure('denied')

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Ditar' }))
      })

      expect(screen.getByRole('status').textContent).toContain('Sem acesso ao microfone')
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
      expect(composer().value).toBe('meu rascunho')
    })
  })
  // --- chat-timing / chat-queue / session-usage ----------------------------

  describe('execution timing', () => {
    it('a running turn reports its phase and the clock keeps counting', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const { emit } = renderChat()
        await screen.findByText('Modelo A')
        fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
          target: { value: 'roda os testes' }
        })
        fireEvent.click(screen.getByText('Enviar'))

        act(() => {
          emit({ type: 'tool', name: 'Bash', detail: 'npm test', toolId: 'b1', phase: 'start' })
        })
        expect(await screen.findByText('Executando')).toBeTruthy()

        // The whole point: the elapsed advances on its own, with no further
        // events — a step that has been running for a minute must not look
        // like one that started a second ago.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(9000)
        })
        expect(screen.getAllByText('9s').length).toBeGreaterThan(0)

        act(() => {
          emit({ type: 'tool', name: '', toolId: 'b1', phase: 'end', ok: true })
        })
        // The step froze at its own duration; the turn's clock keeps going.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000)
        })
        expect(screen.getByText('12s')).toBeTruthy()
        expect(screen.getAllByText('9s')).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('a settled turn leaves a receipt with what it cost', async () => {
      const { emit } = renderChat()
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'escreve o prd' }
      })
      fireEvent.click(screen.getByText('Enviar'))

      act(() => {
        emit({ type: 'tool', name: 'Write', detail: '/ws/prd.md', toolId: 'w1', phase: 'start' })
        emit({ type: 'tool', name: '', toolId: 'w1', phase: 'end', ok: true })
        emit({ type: 'token', text: 'pronto' })
        emit({
          type: 'usage',
          final: true,
          usage: {
            inputTokens: 800,
            cacheReadTokens: 60_000,
            cacheCreationTokens: 14_000,
            outputTokens: 1200,
            costUsd: 0.09
          }
        })
        emit({ type: 'done' })
      })

      expect(await screen.findByText(/^Concluído em/)).toBeTruthy()
      expect(screen.getByText('1 passo')).toBeTruthy()
      expect(screen.getByText('1,2 mil tokens gerados')).toBeTruthy()
      expect(screen.getAllByText('US$ 0,09').length).toBeGreaterThan(0)
    })

    // A one-second "oi" needs no accounting — keeping short turns silent is
    // what keeps the receipt meaningful when it does appear.
    it('a short toolless turn leaves no receipt', async () => {
      const { emit } = renderChat()
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'oi' }
      })
      fireEvent.click(screen.getByText('Enviar'))
      act(() => {
        emit({ type: 'token', text: 'olá' })
        emit({ type: 'done' })
      })

      expect(await screen.findByText('olá')).toBeTruthy()
      expect(screen.queryByText(/^Concluído em/)).toBeNull()
    })
  })

  describe('the send queue', () => {
    const BUSY_PLACEHOLDER = 'Escreva a próxima mensagem — ela entra na fila…'

    async function startTurn(): Promise<ReturnType<typeof renderChat>> {
      const hive = renderChat()
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'primeira' }
      })
      fireEvent.click(screen.getByText('Enviar'))
      await screen.findByPlaceholderText(BUSY_PLACEHOLDER)
      return hive
    }

    async function queueOne(text: string): Promise<void> {
      fireEvent.change(screen.getByPlaceholderText(BUSY_PLACEHOLDER), { target: { value: text } })
      fireEvent.click(screen.getByText('Enfileirar mensagem'))
      await screen.findByText('1 mensagem na fila')
    }

    it('a message sent while a turn runs is queued, not raced against it', async () => {
      await startTurn()
      expect(window.hive.agent.send).toHaveBeenCalledTimes(1)

      await queueOne('segunda')

      expect(screen.getByText('segunda')).toBeTruthy()
      // Nothing was sent: two turns in one conversation would interleave two
      // replies into one transcript and fork the CLI session's memory.
      expect(window.hive.agent.send).toHaveBeenCalledTimes(1)
    })

    it('the head goes out when the turn finishes cleanly', async () => {
      const { emit } = await startTurn()
      await queueOne('segunda')

      await act(async () => {
        emit({ type: 'done' })
      })

      await waitFor(() => expect(window.hive.agent.send).toHaveBeenCalledTimes(2))
      expect(vi.mocked(window.hive.agent.send).mock.calls[1][0]).toBe('segunda')
      expect(screen.queryByText('1 mensagem na fila')).toBeNull()
    })

    // Firing more messages into a session the user just interrupted is the
    // opposite of what pressing Stop meant.
    it('an interrupt holds the queue instead of draining it, and one press releases it', async () => {
      const { emit } = await startTurn()
      await queueOne('segunda')

      await act(async () => {
        emit({ type: 'interrupted' })
      })

      expect(await screen.findByText('Fila pausada — o turno anterior não terminou')).toBeTruthy()
      expect(window.hive.agent.send).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Retomar'))
      await waitFor(() => expect(window.hive.agent.send).toHaveBeenCalledTimes(2))
    })

    it('a queued message can be taken back out before it is sent', async () => {
      const { emit } = await startTurn()
      await queueOne('segunda')

      fireEvent.click(screen.getByRole('button', { name: 'Remover da fila: segunda' }))
      await waitFor(() => expect(screen.queryByText('1 mensagem na fila')).toBeNull())

      await act(async () => {
        emit({ type: 'done' })
      })
      expect(window.hive.agent.send).toHaveBeenCalledTimes(1)
    })

    // The interrupt moved out of the send button into its own control, so the
    // primary button can keep its one job: commit what was typed.
    it('the composer offers stop and queue at once while a turn runs', async () => {
      await startTurn()
      expect(screen.getByRole('button', { name: 'Interromper a resposta do agente' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Enfileirar mensagem' })).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Interromper a resposta do agente' }))
      expect(window.hive.agent.interrupt).toHaveBeenCalled()
    })

    // The messages were written for THAT transcript; discarding them because
    // the user glanced at another conversation is silent data loss — they are
    // parked with the conversation and come back with it, held so one press
    // releases them (the turn they were queued behind may be long gone).
    it('parks the queue with the conversation it belongs to and gives it back', async () => {
      const hive = mockHive()
      const ref = createRef<ChatHandle>()
      render(
        createElement(Chat, {
          workspace: '/ws',
          roleActions,
          agents: ['claude-cli'],
          defaultAgent: 'claude-cli',
          ref
        })
      )
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'primeira' }
      })
      fireEvent.click(screen.getByText('Enviar'))
      await screen.findByPlaceholderText(BUSY_PLACEHOLDER)
      await queueOne('segunda')

      hive.chatHistory.get.mockResolvedValue({
        id: 'outra',
        title: 'Outra',
        agent: null,
        messages: [{ id: 'm1', role: 'user', text: 'outro assunto' }],
        cliSessionId: null
      })
      await act(async () => {
        await ref.current?.openSession('outra')
      })
      expect(screen.queryByText('segunda')).toBeNull()

      hive.chatHistory.get.mockResolvedValue({
        id: 'session-1',
        title: 'Primeira',
        agent: null,
        messages: [{ id: 'm0', role: 'user', text: 'primeira' }],
        cliSessionId: null
      })
      await act(async () => {
        await ref.current?.openSession('session-1')
      })
      expect(await screen.findByText('segunda')).toBeTruthy()
      expect(screen.getByText('Fila pausada — o turno anterior não terminou')).toBeTruthy()
    })
  })

  describe('the context window meter', () => {
    async function reportUsage(over: Record<string, number> = {}): Promise<void> {
      const { emit } = renderChat()
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'oi' }
      })
      fireEvent.click(screen.getByText('Enviar'))
      act(() => {
        emit({
          type: 'usage',
          final: true,
          usage: {
            inputTokens: 800,
            cacheReadTokens: 60_000,
            cacheCreationTokens: 14_000,
            outputTokens: 1200,
            model: 'claude-opus-5',
            costUsd: 0.09,
            apiDurationMs: 21_000,
            ...over
          }
        })
        emit({ type: 'done' })
      })
    }

    // Nothing to report is not a widget showing zero — the meter simply is not
    // there until a turn has said something about the window.
    it('stays absent until a turn reports usage', async () => {
      const { emit } = renderChat()
      await screen.findByText('Modelo A')
      fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
        target: { value: 'oi' }
      })
      fireEvent.click(screen.getByText('Enviar'))
      act(() => emit({ type: 'token', text: 'ola' }))
      // A turn is running and streaming, and still there is nothing to show:
      // an adapter that reports no usage gets no widget, not a widget at zero.
      expect(screen.queryByText('de contexto')).toBeNull()

      act(() => {
        emit({
          type: 'usage',
          final: true,
          usage: {
            inputTokens: 800,
            cacheReadTokens: 60_000,
            cacheCreationTokens: 14_000,
            outputTokens: 1200
          }
        })
        emit({ type: 'done' })
      })
      expect(await screen.findByText('de contexto')).toBeTruthy()
      expect(screen.getByText('37%')).toBeTruthy()
    })

    it('opens a breakdown of what the model actually read', async () => {
      await reportUsage()
      fireEvent.click(await screen.findByText('de contexto'))

      expect(await screen.findByText('Contexto da sessão')).toBeTruthy()
      // 800 + 60 000 + 14 000 — output is excluded, because it only joins the
      // context on the NEXT request.
      expect(screen.getByText('74,8 mil')).toBeTruthy()
      expect(screen.getByText('de 200 mil')).toBeTruthy()
      expect(screen.getByText('Reaproveitado do cache')).toBeTruthy()
      expect(screen.getByText('60 mil')).toBeTruthy()
      // Session totals, off the same final report.
      expect(screen.getByText('1,2 mil')).toBeTruthy()
      expect(screen.getAllByText('US$ 0,09').length).toBeGreaterThan(0)
      expect(screen.getByText('claude-opus-5')).toBeTruthy()
    })

    it('turns advisory, with a way out, once the window is nearly full', async () => {
      await reportUsage({ cacheReadTokens: 160_000 })
      expect(await screen.findByText('87%')).toBeTruthy()

      fireEvent.click(screen.getByText('de contexto'))
      expect(
        await screen.findByText(
          'A janela está quase cheia. Daqui pra frente o agente pode perder o começo da conversa.'
        )
      ).toBeTruthy()

      await act(async () => {
        fireEvent.click(screen.getByText('Começar uma conversa nova'))
      })
      // A fresh conversation knows nothing about the window until its own
      // first turn reports one, so the meter goes with it.
      expect(screen.queryByText('de contexto')).toBeNull()
    })
  })
})

describe('workspaceRelative (agent-patch)', () => {
  it('turns the CLI’s absolute path into the address the editor uses', () => {
    expect(workspaceRelative('/ws', '/ws/src/chat/Chat.tsx')).toBe('src/chat/Chat.tsx')
    expect(workspaceRelative('/ws/', '/ws/a.md')).toBe('a.md')
  })

  it('normalises Windows separators, since the editor tree is POSIX throughout', () => {
    expect(workspaceRelative('C:\\work\\ws', 'C:\\work\\ws\\src\\a.ts')).toBe('src/a.ts')
  })

  it('opens nothing for a file outside the workspace rather than the wrong file', () => {
    expect(workspaceRelative('/ws', '/etc/passwd')).toBeNull()
    // A sibling directory whose name merely starts with the workspace's.
    expect(workspaceRelative('/ws', '/ws-other/a.ts')).toBeNull()
    // The workspace root itself is not a file to open.
    expect(workspaceRelative('/ws', '/ws')).toBeNull()
  })
})
