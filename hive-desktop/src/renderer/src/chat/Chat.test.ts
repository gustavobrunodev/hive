// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Chat } from './Chat'

/**
 * Task T15 — Chat UI (design.md §4 "Chat" row, R6.1, R6.4) + T18 — new-session
 * intent placeholders (R7.1).
 *
 * Same mocking approach as Explorer.test.ts/GuidedInstall.test.ts:
 * `@hive/design-system` gets trivial DOM stand-ins (a real render would load
 * a second React instance from design-system's own node_modules), and
 * `window.hive` is mocked per test.
 *
 * `Select`/`SelectItem` need a bit more than the others: Radix's real Select
 * is portal/popover-based, so the mock always renders `SelectContent`'s
 * items (no open/closed state) and wires `onValueChange` through a small
 * context, letting tests "pick" an option by clicking its rendered label.
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
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('h2', null, title),
      createElement('p', null, description)
    ),
  Badge: ({ children, ...rest }: { children?: ReactNode }) => createElement('span', rest, children),
  SkillGrid: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SkillCard: ({
    title,
    lead,
    children,
    onClick,
    onKeyDown,
    ...rest
  }: {
    title?: ReactNode
    lead?: boolean
    children?: ReactNode
    onClick?: () => void
    onKeyDown?: (event: { key: string; preventDefault: () => void }) => void
  }) =>
    createElement(
      'article',
      { ...rest, 'data-lead': lead, onClick, onKeyDown },
      createElement('h3', null, title),
      children
    ),
  MessageList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  PromptInput: ({
    onSubmit,
    placeholder,
    sendLabel,
    streaming,
    toolbar
  }: {
    onSubmit: (value: string) => void
    placeholder?: string
    sendLabel?: string
    streaming?: boolean
    toolbar?: ReactNode
  }) => {
    let inputValue = ''
    return createElement(
      'div',
      null,
      createElement('input', {
        placeholder,
        onChange: (event: { target: { value: string } }) => {
          inputValue = event.target.value
        }
      }),
      createElement(
        'button',
        { disabled: streaming, onClick: () => onSubmit(inputValue) },
        sendLabel
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

describe('Chat (T15)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  interface AgentEventLike {
    type: string
    text?: string
    message?: string
  }

  const defaultWorkflowEntries = [
    {
      key: 'prd',
      label: 'Create a PRD',
      command: { key: 'bmad-prd', prompt: 'Use bmad-prd.' },
      status: 'wired'
    },
    {
      key: 'domain-research',
      label: 'Domain Research',
      command: { key: 'bmad-domain-research' },
      status: 'planned'
    }
  ]

  function mockHive(workflowEntries: typeof defaultWorkflowEntries = defaultWorkflowEntries): {
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
          efforts: [
            { id: 'low', label: 'Baixo' },
            { id: 'high', label: 'Alto' }
          ],
          supportsAttachments: false
        }),
        start: vi.fn((opts: { workspace: string; model: string; effort: string }) => {
          startCalls.push(opts)
          return Promise.resolve()
        }),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn((onEvent: (event: AgentEventLike) => void) => {
          capturedOnEvent = onEvent
          return vi.fn()
        })
      },
      workflows: {
        list: vi.fn().mockResolvedValue(workflowEntries)
      }
    }
    return {
      emit: (event: AgentEventLike) => capturedOnEvent?.(event),
      startCalls
    }
  }

  it('shows the intent grid before any messages, and loads capabilities-driven model/effort options', async () => {
    mockHive()

    render(createElement(Chat, { workspace: '/ws' }))

    expect(screen.getByText('O que você quer fazer hoje?')).toBeTruthy()
    expect(await screen.findByText('Modelo A')).toBeTruthy()
    expect(screen.getByText('Modelo B')).toBeTruthy()
    expect(screen.getByText('Baixo')).toBeTruthy()
    expect(screen.getByText('Alto')).toBeTruthy()
  })

  it('renders the wired PRD intent as lead/clickable and a planned intent as non-interactive with a badge (T18)', async () => {
    mockHive()

    render(createElement(Chat, { workspace: '/ws' }))

    const prdCard = await screen.findByText('Criar um PRD')
    expect(prdCard.closest('article')?.getAttribute('data-lead')).toBe('true')

    const researchCard = await screen.findByText('Pesquisar um domínio')
    expect(researchCard.closest('article')?.getAttribute('data-lead')).toBe('false')
    expect(screen.getByText('Em breve')).toBeTruthy()
  })

  it('clicking the wired PRD intent calls agent.runWorkflow() with its command and renders it as a user message (R7.2)', async () => {
    mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    const prdCard = await screen.findByText('Criar um PRD')

    fireEvent.click(prdCard.closest('article') as Element)

    expect(window.hive.agent.runWorkflow).toHaveBeenCalledWith({
      key: 'bmad-prd',
      prompt: 'Use bmad-prd.'
    })
    expect(await screen.findByTestId('typing-indicator')).toBeTruthy()
  })

  it('starts a session with the first model/effort as defaults once capabilities load', async () => {
    const { startCalls } = mockHive()

    render(createElement(Chat, { workspace: '/ws' }))

    await waitFor(() => {
      expect(startCalls).toContainEqual({ workspace: '/ws', model: 'model-a', effort: 'low' })
    })
  })

  it('sending a message renders it as a user ChatMessage and calls agent.send()', async () => {
    mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    await screen.findByText('Modelo A')

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'Olá, agente' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(await screen.findByText('Olá, agente')).toBeTruthy()
    expect(window.hive.agent.send).toHaveBeenCalledWith('Olá, agente')
  })

  it('streams token events into a growing assistant message, then finalizes it on done', async () => {
    const { emit } = mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    await screen.findByText('Modelo A')

    expect(screen.queryByTestId('typing-indicator')).toBeNull()

    emit({ type: 'token', text: 'Olá' })
    await screen.findByText('Olá')

    emit({ type: 'token', text: ', tudo bem?' })
    await screen.findByText('Olá, tudo bem?')

    emit({ type: 'done' })
    await waitFor(() => {
      expect(screen.getByText('Olá, tudo bem?')).toBeTruthy()
    })
  })

  it('shows the typing indicator immediately on submit, before the first token arrives', async () => {
    mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    await screen.findByText('Modelo A')

    fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), {
      target: { value: 'oi' }
    })
    fireEvent.click(screen.getByText('Enviar'))

    expect(await screen.findByTestId('typing-indicator')).toBeTruthy()
  })

  it('shows an Alert with the error message on an error event', async () => {
    const { emit } = mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    await screen.findByText('Modelo A')

    emit({ type: 'error', message: 'processo falhou' })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Não foi possível concluir a resposta: processo falhou')).toBeTruthy()
  })

  it('restarts the session with the newly selected model', async () => {
    const { startCalls } = mockHive()

    render(createElement(Chat, { workspace: '/ws' }))
    await waitFor(() => {
      expect(startCalls).toContainEqual({ workspace: '/ws', model: 'model-a', effort: 'low' })
    })

    fireEvent.click(screen.getByText('Modelo B'))

    await waitFor(() => {
      expect(startCalls).toContainEqual({ workspace: '/ws', model: 'model-b', effort: 'low' })
    })
  })
})
