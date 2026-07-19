// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionHistory } from './SessionHistory'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'

/**
 * Session-history panel tests: the "Nova conversa" trigger, the popover's
 * lazy list load (search, recency groups, empty/no-match states), inline
 * rename/delete, and the delete-active-session → reset-pane coupling.
 *
 * Same DS-mock approach as Chat.test.ts; `window.hive.chatHistory` is mocked
 * per test.
 */
const PopoverCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

vi.mock('@hive/design-system', () => ({
  Popover: ({
    onOpenChange,
    children
  }: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }) => createElement(PopoverCtx.Provider, { value: { onOpenChange } }, children),
  PopoverTrigger: ({ children }: { asChild?: boolean; children?: ReactNode }) => {
    const ctx = useContext(PopoverCtx)
    return createElement('span', { onClick: () => ctx.onOpenChange?.(true) }, children)
  },
  PopoverContent: ({
    children,
    className,
    'aria-label': ariaLabel
  }: {
    children?: ReactNode
    className?: string
    'aria-label'?: string
    align?: string
    sideOffset?: number
    onEscapeKeyDown?: (event: Event) => void
  }) => createElement('div', { role: 'dialog', className, 'aria-label': ariaLabel }, children),
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('h3', null, title),
      createElement('p', null, description)
    ),
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' })
}))

describe('SessionHistory', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const HOUR = 3_600_000
  const DAY = 24 * HOUR

  function meta(overrides: Partial<ChatSessionMeta>): ChatSessionMeta {
    return {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Conversa qualquer',
      // Seconds ago, not an hour ago: "an hour ago" crosses into "Ontem"
      // when the suite runs just after midnight (flaked at 00:04 once).
      createdAt: Date.now() - 5_000,
      updatedAt: Date.now() - 5_000,
      messageCount: 3,
      agent: 'claude-cli',
      preview: 'último trecho…',
      ...overrides
    }
  }

  function mockChatHistory(sessions: ChatSessionMeta[]): {
    list: ReturnType<typeof vi.fn>
    rename: ReturnType<typeof vi.fn>
    search: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  } {
    const chatHistory = {
      list: vi.fn().mockResolvedValue(sessions),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      append: vi.fn(),
      rename: vi
        .fn()
        .mockImplementation((_ws: string, id: string, title: string) =>
          Promise.resolve({ ...sessions.find((s) => s.id === id)!, title })
        ),
      setCliSession: vi.fn().mockResolvedValue(undefined),
      // Default full-text stand-in mirrors the local title/preview filter so
      // the debounced IPC result never contradicts the instant local one;
      // the dedicated full-text test overrides it.
      search: vi
        .fn()
        .mockImplementation((_ws: string, query: string) =>
          Promise.resolve(
            sessions.filter((s) =>
              `${s.title} ${s.preview}`.toLowerCase().includes(query.toLowerCase())
            )
          )
        ),
      delete: vi.fn().mockResolvedValue(undefined)
    }
    window.hive = { ...window.hive, chatHistory } as unknown as typeof window.hive
    return chatHistory
  }

  interface RenderProps {
    activeSessionId?: string | null
    runningSessionIds?: string[]
    onNewConversation?: () => void
    onOpenSession?: (id: string) => void
  }

  function renderPanel(
    sessions: ChatSessionMeta[],
    props: RenderProps = {}
  ): ReturnType<typeof mockChatHistory> {
    const chatHistory = mockChatHistory(sessions)
    render(
      createElement(SessionHistory, {
        workspace: '/ws',
        activeSessionId: props.activeSessionId ?? null,
        runningSessionIds: props.runningSessionIds ?? [],
        onNewConversation: props.onNewConversation ?? vi.fn(),
        onOpenSession: props.onOpenSession ?? vi.fn()
      })
    )
    return chatHistory
  }

  function openPanel(): void {
    fireEvent.click(screen.getByLabelText('Histórico de conversas'))
  }

  it('"Nova conversa" calls onNewConversation without opening the panel', () => {
    const onNewConversation = vi.fn()
    const chatHistory = renderPanel([], { onNewConversation })
    fireEvent.click(screen.getByLabelText('Nova conversa'))
    expect(onNewConversation).toHaveBeenCalledTimes(1)
    expect(chatHistory.list).not.toHaveBeenCalled()
  })

  it('opening the panel loads the list and groups rows by recency', async () => {
    renderPanel([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'De hoje' }),
      meta({
        id: '00000000-0000-4000-8000-00000000000b',
        title: 'De três dias atrás',
        updatedAt: Date.now() - 3 * DAY
      })
    ])
    openPanel()

    expect(await screen.findByText('De hoje')).toBeTruthy()
    expect(screen.getByText('De três dias atrás')).toBeTruthy()
    expect(screen.getByText('Hoje')).toBeTruthy()
    expect(screen.getByText('Últimos 7 dias')).toBeTruthy()
    expect(screen.getAllByText('3 mensagens')).toHaveLength(2)
  })

  it('shows a teaching empty state when there are no conversations', async () => {
    renderPanel([])
    openPanel()
    expect(await screen.findByText('Nenhuma conversa ainda')).toBeTruthy()
    expect(
      screen.getByText('Suas conversas com os agentes ficam guardadas aqui, por workspace.')
    ).toBeTruthy()
  })

  it('search filters by title/preview and reports no-match', async () => {
    renderPanel([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'PRD financeiro' }),
      meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Brainstorm de onboarding' })
    ])
    openPanel()
    await screen.findByText('PRD financeiro')

    const search = screen.getByPlaceholderText('Buscar conversas…')
    fireEvent.change(search, { target: { value: 'brainstorm' } })
    expect(screen.queryByText('PRD financeiro')).toBeNull()
    expect(screen.getByText('Brainstorm de onboarding')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('Nada encontrado para "zzz".')).toBeTruthy()
  })

  it('clicking a row opens the session and closes the panel', async () => {
    const onOpenSession = vi.fn()
    renderPanel([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Abrir esta' })], {
      onOpenSession
    })
    openPanel()
    fireEvent.click(await screen.findByText('Abrir esta'))

    expect(onOpenSession).toHaveBeenCalledWith('00000000-0000-4000-8000-00000000000a')
    await waitFor(() => expect(screen.queryByText('Abrir esta')).toBeNull())
  })

  // background-turns: a conversation whose reply is still being generated.
  it('shows the "Em andamento" indicator on running conversations instead of time·count', async () => {
    renderPanel(
      [
        meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Rodando agora' }),
        meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Parada' })
      ],
      { runningSessionIds: ['00000000-0000-4000-8000-00000000000a'] }
    )
    openPanel()
    await screen.findByText('Rodando agora')

    expect(screen.getByText('Em andamento')).toBeTruthy()
    // The stopped conversation keeps its normal meta line.
    expect(screen.getByText('3 mensagens')).toBeTruthy()
  })

  it('marks the active conversation with the "Atual" badge', async () => {
    renderPanel([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Ativa' })], {
      activeSessionId: '00000000-0000-4000-8000-00000000000a'
    })
    openPanel()
    await screen.findByText('Ativa')
    expect(screen.getByText('Atual')).toBeTruthy()
  })

  it('inline rename commits through chatHistory.rename', async () => {
    const chatHistory = renderPanel([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Título antigo' })
    ])
    openPanel()
    await screen.findByText('Título antigo')

    fireEvent.click(screen.getByLabelText('Renomear Título antigo'))
    const input = screen.getByLabelText('Título da conversa')
    fireEvent.change(input, { target: { value: 'Título novo' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(chatHistory.rename).toHaveBeenCalledWith(
        '/ws',
        '00000000-0000-4000-8000-00000000000a',
        'Título novo'
      )
    )
    expect(await screen.findByText('Título novo')).toBeTruthy()
  })

  it('delete asks for inline confirmation and removes the row', async () => {
    const chatHistory = renderPanel([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Para excluir' })
    ])
    openPanel()
    await screen.findByText('Para excluir')

    fireEvent.click(screen.getByLabelText('Excluir Para excluir'))
    expect(chatHistory.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Excluir esta conversa?')).toBeTruthy()

    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() =>
      expect(chatHistory.delete).toHaveBeenCalledWith('/ws', '00000000-0000-4000-8000-00000000000a')
    )
    await waitFor(() => expect(screen.queryByText('Para excluir')).toBeNull())
  })

  it('cancelling the delete confirmation keeps the conversation', async () => {
    const chatHistory = renderPanel([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Fica' })
    ])
    openPanel()
    await screen.findByText('Fica')

    fireEvent.click(screen.getByLabelText('Excluir Fica'))
    fireEvent.click(screen.getByText('Cancelar'))

    expect(chatHistory.delete).not.toHaveBeenCalled()
    expect(await screen.findByText('Fica')).toBeTruthy()
  })

  it('deleting the ACTIVE conversation also resets the pane via onNewConversation', async () => {
    const onNewConversation = vi.fn()
    renderPanel([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Ativa' })], {
      activeSessionId: '00000000-0000-4000-8000-00000000000a',
      onNewConversation
    })
    openPanel()
    await screen.findByText('Ativa')

    fireEvent.click(screen.getByLabelText('Excluir Ativa'))
    fireEvent.click(screen.getByText('Excluir'))

    await waitFor(() => expect(onNewConversation).toHaveBeenCalledTimes(1))
  })

  it('sessionTitle falls back to the untitled label', () => {
    expect(sessionTitle({ title: '' })).toBe('Conversa sem título')
    expect(sessionTitle({ title: 'Com título' })).toBe('Com título')
  })

  // session-history full-text search: a hit inside a message body (invisible
  // to the local title/preview filter) arrives via the debounced IPC search
  // and shows its matched snippet on the row.
  it('full-text search surfaces message-body hits with a snippet', async () => {
    const target = meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Sem relação' })
    const chatHistory = renderPanel([target])
    chatHistory.search.mockResolvedValue([
      { ...target, match: '…retentativa em cascata para pagamentos…' }
    ])
    openPanel()
    await screen.findByText('Sem relação')

    fireEvent.change(screen.getByPlaceholderText('Buscar conversas…'), {
      target: { value: 'cascata' }
    })

    expect(await screen.findByText('…retentativa em cascata para pagamentos…')).toBeTruthy()
    expect(screen.getByText('Sem relação')).toBeTruthy()
    expect(chatHistory.search).toHaveBeenCalledWith('/ws', 'cascata')
  })
})
