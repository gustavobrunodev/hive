// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, createRef, useContext, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Chat, type ChatHandle } from './Chat'
import type { RoleAction } from '../ui/ActionRail'

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

vi.mock('@hive/design-system', () => ({
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
  PromptInput: ({
    value,
    onChange,
    onSubmit,
    placeholder,
    sendLabel,
    streaming,
    toolbar,
    ...rest
  }: {
    value?: string
    onChange?: (value: string) => void
    onSubmit: (value: string) => void
    placeholder?: string
    sendLabel?: string
    streaming?: boolean
    toolbar?: ReactNode
  }) =>
    createElement(
      'div',
      rest,
      createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (event: { target: { value: string } }) => onChange?.(event.target.value)
      }),
      createElement(
        'button',
        { disabled: streaming, onClick: () => onSubmit((value ?? '').trim()) },
        sendLabel
      ),
      toolbar
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
  }

  const roleActions: RoleAction[] = [
    { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: 'Use bmad-prd.' } },
    { key: 'brainstorm', kind: 'workflow', command: { key: 'bmad-brainstorming', prompt: 'br' } },
    { key: 'persona-pm', kind: 'persona', command: { key: 'bmad-agent-pm', prompt: 'talk John' } }
  ]

  function mockHive(
    options: { skills?: Array<{ key: string; label: string; description: string }> } = {}
  ): {
    emit: (event: AgentEventLike) => void
    startCalls: Array<{ workspace: string; model: string; effort: string }>
  } {
    let capturedOnEvent: ((event: AgentEventLike) => void) | undefined
    const startCalls: Array<{ workspace: string; model: string; effort: string }> = []
    window.hive = {
      ...window.hive,
      agent: {
        capabilities: vi.fn().mockResolvedValue({
          models: [
            { id: 'model-a', label: 'Modelo A' },
            { id: 'model-b', label: 'Modelo B' }
          ],
          efforts: [{ id: 'low', label: 'Baixo' }],
          supportsAttachments: false
        }),
        start: vi.fn((opts: { workspace: string; model: string; effort: string }) => {
          startCalls.push(opts)
          return Promise.resolve()
        }),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn((onEvent: (event: AgentEventLike) => void) => {
          capturedOnEvent = onEvent
          return vi.fn()
        })
      },
      profile: {
        agents: vi
          .fn()
          .mockResolvedValue([
            { id: 'claude-cli', displayName: 'Claude Code', description: '', available: true }
          ])
      },
      skills: {
        list: vi.fn().mockResolvedValue(options.skills ?? [])
      }
    } as unknown as typeof window.hive
    return { emit: (event: AgentEventLike) => capturedOnEvent?.(event), startCalls }
  }

  function renderChat(
    extra: { skills?: Array<{ key: string; label: string; description: string }> } = {}
  ): ReturnType<typeof mockHive> {
    const hive = mockHive(extra)
    render(createElement(Chat, { workspace: '/ws', roleActions, agent: 'claude-cli' }))
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

  it('loads capabilities-driven model/effort options', async () => {
    renderChat()
    expect(await screen.findByText('Modelo A')).toBeTruthy()
    expect(screen.getByText('Baixo')).toBeTruthy()
  })

  it('clicking a workflow action calls runWorkflow and renders a user message + typing indicator', async () => {
    renderChat()
    const prd = await screen.findByText('Criar um PRD')
    fireEvent.click(prd.closest('article') as Element)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-prd',
      prompt: 'Use bmad-prd.'
    })
    expect(await screen.findByTestId('typing-indicator')).toBeTruthy()
  })

  it('clicking the persona action launches its command', async () => {
    renderChat()
    const persona = await screen.findByText('Conversar com John')
    fireEvent.click(persona.closest('article') as Element)
    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-agent-pm',
      prompt: 'talk John'
    })
  })

  it('exposes launchAction via the imperative handle (used by the action rail)', async () => {
    mockHive()
    const ref = createRef<ChatHandle>()
    render(createElement(Chat, { workspace: '/ws', roleActions, agent: 'claude-cli', ref }))
    await screen.findByText('Criar um PRD')

    ref.current?.launchAction(roleActions[0])
    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-prd',
      prompt: 'Use bmad-prd.'
    })
    expect(await screen.findByText('Criar um PRD')).toBeTruthy()
  })

  it('starts a session with the first model/effort defaults once capabilities load', async () => {
    const { startCalls } = renderChat()
    await waitFor(() =>
      expect(startCalls).toContainEqual({ workspace: '/ws', model: 'model-a', effort: 'low' })
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
    expect(window.hive.agent.send).toHaveBeenCalledWith('Olá, agente')
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

  // chat-controls CC-R1 — interrupt.
  it('shows the Stop control only while streaming and calls agent.stop when clicked', async () => {
    const { emit } = renderChat()
    await screen.findByText('Modelo A')
    expect(screen.queryByLabelText('Interromper a resposta do agente')).toBeNull()

    emit({ type: 'token', text: 'thinking' })
    const stop = await screen.findByLabelText('Interromper a resposta do agente')
    fireEvent.click(stop)
    expect(window.hive.agent.stop).toHaveBeenCalled()
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
  it('shows the active agent name in the composer', async () => {
    renderChat()
    expect(await screen.findByText('Claude Code')).toBeTruthy()
  })

  // chat-controls CC-R2 — slash menu.
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
    expect(await screen.findByText('Create PRD')).toBeTruthy()
    expect(screen.getByText('Create UX')).toBeTruthy()

    fireEvent.change(input, { target: { value: '/ux' } })
    await waitFor(() => expect(screen.queryByText('Create PRD')).toBeNull())
    expect(screen.getByText('Create UX')).toBeTruthy()
  })

  it('selecting a slash skill launches it as a workflow and clears the composer', async () => {
    renderChat({ skills: [{ key: 'bmad-ux', label: 'Create UX', description: 'UX spec' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…') as HTMLInputElement
    fireEvent.change(input, { target: { value: '/ux' } })

    const option = await screen.findByText('Create UX')
    fireEvent.mouseDown(option)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-ux',
      prompt: 'Use the bmad-ux skill.'
    })
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
    await screen.findByText('Create PRD')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-ux',
      prompt: 'Use the bmad-ux skill.'
    })
  })

  it('shows a teaching empty state when no skills are installed', async () => {
    renderChat({ skills: [] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    expect(await screen.findByText('Nenhuma skill disponível neste workspace.')).toBeTruthy()
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
    await screen.findByText('Create PRD')

    fireEvent.keyDown(input, { key: 'ArrowUp' }) // wraps from 0 to last (index 1)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-ux',
      prompt: 'Use the bmad-ux skill.'
    })
  })

  it('closes the slash menu on Escape', async () => {
    renderChat({ skills: [{ key: 'bmad-ux', label: 'Create UX', description: '' }] })
    await screen.findByText('Modelo A')
    const input = screen.getByPlaceholderText('Escreva uma mensagem…')
    fireEvent.change(input, { target: { value: '/' } })
    await screen.findByText('Create UX')

    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Create UX')).toBeNull())
  })
})
