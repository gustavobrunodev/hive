// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, createRef, useContext, type ReactNode } from 'react'
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Chat, type ChatHandle } from './Chat'
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
const SelectContext = createContext<{ onValueChange?: (value: string) => void } | null>(null)
const DropdownRadioContext = createContext<{ onValueChange?: (value: string) => void } | null>(null)

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
      rest,
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
      toolbar
    )
  },
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
  }
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
        capabilities: vi.fn().mockResolvedValue({
          models: [
            { id: 'model-a', label: 'Modelo A' },
            { id: 'model-b', label: 'Modelo B' }
          ],
          efforts: [{ id: 'low', label: 'Baixo' }],
          supportsAttachments: true
        }),
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

  it('clicking a workflow action calls runWorkflow and renders a user message + typing indicator', async () => {
    renderChat()
    const prd = await screen.findByText('Criar um PRD')
    fireEvent.click(prd.closest('article') as Element)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith(
      { key: 'bmad-prd', prompt: '/bmad-prd' },
      expect.objectContaining({ agentId: 'claude-cli', resume: null, turnId: expect.any(String) })
    )
    // The transcript shows the slash command that was invoked, verbatim.
    expect(await screen.findByText('/bmad-prd')).toBeTruthy()
    expect(await screen.findByTestId('typing-indicator')).toBeTruthy()
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

    // Partial preserved, streaming indicator gone, no error.
    expect(await screen.findByText('partial answer')).toBeTruthy()
    expect(screen.queryByTestId('typing-indicator')).toBeNull()
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
    emit({ type: 'done' })
    // Re-query: the hero → conversation transition remounts the composer.
    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
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
})
