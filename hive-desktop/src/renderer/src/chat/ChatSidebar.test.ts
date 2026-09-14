// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectionDsMocks } from '../testSupport/dsMocks'
import { createContext, createElement, useContext, useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ChatSidebar, NewConversationButton } from './ChatSidebar'
import { AllConversationsDialog, type AllConversationsDialogProps } from './AllConversationsDialog'
import { useChatSessions } from './useChatSessions'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'
import {
  DEFAULT_SORT,
  DEFAULT_WINDOW,
  type ActivityWindow,
  type ConversationSort
} from './conversationFilters'

/**
 * The sidebar's conversation section and the wide archive behind "Ver todas as
 * conversas" (nav-redesign).
 *
 * This suite inherits the old history popover's coverage — the lazy load,
 * recency groups, search, inline rename, two-step delete, the running and
 * pending-review markers, and the delete-the-open-one → reset-the-pane coupling
 * — because those behaviours moved rather than changed. What is new is the lens
 * (window + order), the six list states, and the hand-off between the two
 * surfaces.
 *
 * Same DS-mock approach as `Chat.test.ts`; `window.hive.chatHistory` is mocked
 * per test.
 */
const RadioCtx = createContext<{ value?: string; onValueChange?: (v: string) => void }>({})
const MenuCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})
const DialogCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

vi.mock('@hive/design-system', () => ({
  ...selectionDsMocks(),
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('h3', null, title),
      createElement('p', null, description)
    ),
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' }),
  DropdownMenu: ({
    onOpenChange,
    children
  }: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }) => createElement(MenuCtx.Provider, { value: { onOpenChange } }, children),
  DropdownMenuTrigger: ({ children }: { asChild?: boolean; children?: ReactNode }) => {
    const ctx = useContext(MenuCtx)
    return createElement('span', { onClick: () => ctx.onOpenChange?.(true) }, children)
  },
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'presentation' }, children),
  DropdownMenuRadioGroup: ({
    value,
    onValueChange,
    children
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: ReactNode
  }) => createElement(RadioCtx.Provider, { value: { value, onValueChange } }, children),
  DropdownMenuRadioItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(RadioCtx)
    return createElement(
      'button',
      {
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': ctx.value === value,
        onClick: () => ctx.onValueChange?.(value)
      },
      children
    )
  },
  Dialog: ({
    children,
    onOpenChange
  }: {
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) => createElement(DialogCtx.Provider, { value: { onOpenChange } }, children),
  DialogContent: ({
    children,
    className,
    onEscapeKeyDown
  }: {
    children?: ReactNode
    className?: string
    onEscapeKeyDown?: (event: KeyboardEvent) => void
  }) => {
    const ctx = useContext(DialogCtx)
    return createElement(
      'div',
      {
        role: 'dialog',
        className,
        onKeyDownCapture: (event: React.KeyboardEvent) => {
          if (event.key !== 'Escape') return
          onEscapeKeyDown?.(event.nativeEvent)
          if (!event.nativeEvent.defaultPrevented) ctx.onOpenChange?.(false)
        }
      },
      children
    )
  },
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children)
}))

const DAY = 86_400_000

function meta(overrides: Partial<ChatSessionMeta>): ChatSessionMeta {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Conversa qualquer',
    // Seconds ago, not an hour ago: "an hour ago" crosses into "Ontem" when the
    // suite runs just after midnight (flaked at 00:04 once).
    createdAt: Date.now() - 5_000,
    updatedAt: Date.now() - 5_000,
    messageCount: 3,
    agent: 'claude-cli',
    preview: 'último trecho…',
    ...overrides
  }
}

interface HistoryMock {
  list: ReturnType<typeof vi.fn>
  rename: ReturnType<typeof vi.fn>
  search: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function mockChatHistory(sessions: ChatSessionMeta[], listFails = false): HistoryMock {
  const chatHistory = {
    list: listFails
      ? vi.fn().mockRejectedValue(new Error('EIO'))
      : vi.fn().mockResolvedValue(sessions),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    append: vi.fn(),
    rename: vi
      .fn()
      .mockImplementation((_ws: string, id: string, title: string) =>
        Promise.resolve({ ...sessions.find((s) => s.id === id)!, title })
      ),
    setCliSession: vi.fn().mockResolvedValue(undefined),
    // Default full-text stand-in mirrors the local title/preview filter so the
    // debounced IPC result never contradicts the instant local one; the
    // dedicated full-text test overrides it.
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

interface HarnessProps {
  activeSessionId?: string | null
  runningSessionIds?: string[]
  reviewPendingBySession?: Record<string, number>
  onOpenSession?: (id: string) => void
  onOpenAll?: () => void
  onNewConversation?: () => void
  initialWindow?: ActivityWindow
  initialSort?: ConversationSort
  initiativeMarks?: Record<string, { title: string; color: 'violet' | 'sky' | 'amber' }>
  initiativeOptions?: { path: string; title: string }[]
}

/** Mounts the hook + the sidebar the way `WorkUI` does (lens lifted above both). */
function Harness(props: HarnessProps): React.JSX.Element {
  const [activityWindow, setWindow] = useState<ActivityWindow>(
    props.initialWindow ?? DEFAULT_WINDOW
  )
  const [sort, setSort] = useState<ConversationSort>(props.initialSort ?? DEFAULT_SORT)
  const [initiativeFilter, setInitiativeFilter] = useState('')
  const store = useChatSessions({
    workspace: '/ws',
    activeSessionId: props.activeSessionId ?? null,
    onNewConversation: props.onNewConversation
  })
  return createElement(ChatSidebar, {
    store,
    window: activityWindow,
    sort,
    onWindowChange: setWindow,
    onSortChange: setSort,
    activeSessionId: props.activeSessionId ?? null,
    runningSessionIds: props.runningSessionIds ?? [],
    reviewPendingBySession: props.reviewPendingBySession ?? {},
    onOpenSession: props.onOpenSession ?? vi.fn(),
    onOpenAll: props.onOpenAll ?? vi.fn(),
    initiativeMarks: props.initiativeMarks ?? {},
    initiativeOptions: props.initiativeOptions ?? [],
    initiativeFilter,
    onInitiativeFilterChange: setInitiativeFilter
  })
}

function renderSidebar(
  sessions: ChatSessionMeta[],
  props: HarnessProps = {},
  listFails = false
): HistoryMock {
  const chatHistory = mockChatHistory(sessions, listFails)
  render(createElement(Harness, props))
  return chatHistory
}

type DialogHarnessProps = Omit<AllConversationsDialogProps, 'store'> & {
  workspace: string
  onNewConversation: () => void
}

function DialogHarness(props: DialogHarnessProps): React.JSX.Element {
  const store = useChatSessions({
    workspace: props.workspace,
    active: props.open,
    activeSessionId: props.activeSessionId,
    onNewConversation: props.onNewConversation
  })
  return createElement(AllConversationsDialog, { ...props, store })
}

function SharedHistoryHarness(): React.JSX.Element {
  const store = useChatSessions({ workspace: '/ws' })
  const [open, setOpen] = useState(true)
  const [window, onWindowChange] = useState<ActivityWindow>('all')
  const [sort, onSortChange] = useState<ConversationSort>('activity')
  const common = {
    store,
    window,
    sort,
    onWindowChange,
    onSortChange,
    activeSessionId: null,
    onOpenSession: vi.fn()
  }
  return createElement(
    'div',
    null,
    createElement(
      'div',
      { 'data-testid': 'sidebar' },
      createElement(ChatSidebar, { ...common, onOpenAll: () => setOpen(true) })
    ),
    createElement(AllConversationsDialog, { ...common, open, onOpenChange: setOpen })
  )
}

/** Picks a value out of one of the two lens menus (they render as `menuitemradio` here). */
function pick(control: RegExp, option: string): void {
  fireEvent.click(screen.getByRole('button', { name: control }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: option }))
}

describe('ChatSidebar — the conversation section', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads on mount and groups rows by recency', async () => {
    renderSidebar([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'De hoje' }),
      meta({
        id: '00000000-0000-4000-8000-00000000000b',
        title: 'De três dias atrás',
        updatedAt: Date.now() - 3 * DAY
      })
    ])

    expect(await screen.findByText('De hoje')).toBeTruthy()
    expect(screen.getByText('De três dias atrás')).toBeTruthy()
    expect(screen.getByText('Hoje')).toBeTruthy()
    expect(screen.getByText('Últimos 7 dias')).toBeTruthy()
    expect(screen.getAllByText('3 mensagens')).toHaveLength(2)
  })

  it('shows a teaching empty state when there are no conversations, and no "ver todas"', async () => {
    renderSidebar([])
    expect(await screen.findByText('Nenhuma conversa ainda')).toBeTruthy()
    expect(
      screen.getByText('Suas conversas com os agentes ficam guardadas aqui, por workspace.')
    ).toBeTruthy()
    // A door to an empty archive is a door to nothing.
    expect(screen.getByText('Ver todas as conversas')).toBeTruthy()
  })

  it('draws skeletons while the first read is in flight', () => {
    renderSidebar([meta({})])
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  /**
   * A failed read is a state, not an empty list. The popover this replaced drew
   * "Nenhuma conversa ainda" over a disk error — telling the user their history
   * was gone when it was merely unread.
   */
  it('reports a failed read as an error, with a retry — never as "no conversations"', async () => {
    const chatHistory = renderSidebar([], {}, true)
    expect(await screen.findByText('Não foi possível carregar as conversas')).toBeTruthy()
    expect(screen.queryByText('Nenhuma conversa ainda')).toBeNull()

    chatHistory.list.mockResolvedValue([meta({ title: 'Voltou' })])
    fireEvent.click(screen.getByText('Tentar de novo'))
    expect(await screen.findByText('Voltou')).toBeTruthy()
  })

  it('filters by last activity, and offers the way back out of an empty window', async () => {
    renderSidebar([
      meta({
        id: '00000000-0000-4000-8000-00000000000a',
        title: 'Antiga',
        updatedAt: Date.now() - 10 * DAY
      })
    ])
    await screen.findByText('Antiga')

    pick(/^Filtrar por última atividade/, '1 dia')
    expect(screen.queryByText('Antiga')).toBeNull()
    // Distinct from "no conversations at all", and it ships the undo.
    expect(screen.getByText('Nenhuma conversa com atividade nos últimos 1 dia.')).toBeTruthy()

    fireEvent.click(screen.getByText('Ver todos os períodos'))
    expect(await screen.findByText('Antiga')).toBeTruthy()
  })

  it('states the window in force on the trigger, without being opened', async () => {
    renderSidebar([meta({})])
    await screen.findByText('Conversa qualquer')
    pick(/^Filtrar por última atividade/, '7 dias')
    expect(
      screen.getByRole('button', { name: 'Filtrar por última atividade: 7 dias' })
    ).toBeTruthy()
  })

  it('orders by name, by creation and by last activity', async () => {
    renderSidebar([
      meta({
        id: '00000000-0000-4000-8000-00000000000a',
        title: 'Zebra',
        createdAt: Date.now() - 5 * DAY,
        updatedAt: Date.now() - 1000
      }),
      meta({
        id: '00000000-0000-4000-8000-00000000000b',
        title: 'Alfa',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 5 * DAY
      })
    ])
    await screen.findByText('Zebra')

    const titles = (): string[] =>
      screen.getAllByText(/^(Zebra|Alfa)$/).map((node) => node.textContent ?? '')

    // Last activity (the default): Zebra moved most recently.
    expect(titles()).toEqual(['Zebra', 'Alfa'])

    pick(/^Ordenar conversas/, 'Recém-criadas')
    expect(titles()).toEqual(['Alfa', 'Zebra'])

    pick(/^Ordenar conversas/, 'Nome')
    expect(titles()).toEqual(['Alfa', 'Zebra'])
    // Name order drops the recency headings — they would claim the rows are
    // adjacent for a reason that is no longer true.
    expect(screen.queryByText('Hoje')).toBeNull()

    pick(/^Ordenar conversas/, 'Última atividade')
    expect(screen.getByText('Hoje')).toBeTruthy()
  })

  it('caps the preview and says how much more the archive holds', async () => {
    renderSidebar(
      Array.from({ length: 15 }, (_, index) =>
        meta({
          id: `00000000-0000-4000-8000-0000000000${(index + 10).toString(16)}`,
          title: `Conversa ${index}`,
          updatedAt: Date.now() - index * 1000
        })
      )
    )
    await screen.findByText('Conversa 0')

    expect(screen.getByText('Conversa 11')).toBeTruthy()
    expect(screen.queryByText('Conversa 12')).toBeNull()
    expect(screen.getByText('+3')).toBeTruthy()
  })

  it('"Ver todas as conversas" reports up', async () => {
    const onOpenAll = vi.fn()
    renderSidebar([meta({})], { onOpenAll })
    await screen.findByText('Conversa qualquer')
    fireEvent.click(screen.getByText('Ver todas as conversas'))
    expect(onOpenAll).toHaveBeenCalledTimes(1)
  })

  it('clicking a row opens the session', async () => {
    const onOpenSession = vi.fn()
    renderSidebar([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Abrir esta' })], {
      onOpenSession
    })
    fireEvent.click(await screen.findByText('Abrir esta'))
    expect(onOpenSession).toHaveBeenCalledWith('00000000-0000-4000-8000-00000000000a')
  })

  // background-turns: a conversation whose reply is still being generated.
  it('shows "Em andamento" on running conversations instead of time·count', async () => {
    renderSidebar(
      [
        meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Rodando agora' }),
        meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Parada' })
      ],
      { runningSessionIds: ['00000000-0000-4000-8000-00000000000a'] }
    )
    await screen.findByText('Rodando agora')

    expect(screen.getByText('Em andamento')).toBeTruthy()
    expect(screen.getByText('3 mensagens')).toBeTruthy()
  })

  /**
   * Agent Change Review: a turn's change card renders only in the conversation
   * it was asked from, so this row marker is what keeps a review waiting
   * elsewhere findable rather than merely out of sight.
   */
  it('marks conversations still holding files to review, and says how many', async () => {
    renderSidebar(
      [
        meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Com revisão' }),
        meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Sem revisão' })
      ],
      { reviewPendingBySession: { '00000000-0000-4000-8000-00000000000a': 2 } }
    )
    await screen.findByText('Com revisão')

    expect(screen.getByText('2 pendentes')).toBeTruthy()
    expect(screen.getAllByText('3 mensagens')).toHaveLength(2)
    expect(
      screen.getByLabelText('Abrir conversa: Com revisão — 2 mudanças pendentes de revisão')
    ).toBeTruthy()
    expect(screen.getByLabelText('Abrir conversa: Sem revisão')).toBeTruthy()
  })

  it('marks the active conversation with the "Atual" badge', async () => {
    renderSidebar([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Ativa' })], {
      activeSessionId: '00000000-0000-4000-8000-00000000000a'
    })
    await screen.findByText('Ativa')
    expect(screen.getByText('Atual')).toBeTruthy()
  })

  it('inline rename commits through chatHistory.rename', async () => {
    const chatHistory = renderSidebar([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Título antigo' })
    ])
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
    const chatHistory = renderSidebar([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Para excluir' })
    ])
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
    const chatHistory = renderSidebar([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Fica' })
    ])
    await screen.findByText('Fica')

    fireEvent.click(screen.getByLabelText('Excluir Fica'))
    fireEvent.click(screen.getByText('Cancelar'))

    expect(chatHistory.delete).not.toHaveBeenCalled()
    expect(await screen.findByText('Fica')).toBeTruthy()
  })

  it('deleting the ACTIVE conversation also resets the pane', async () => {
    const onNewConversation = vi.fn()
    renderSidebar([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Ativa' })], {
      activeSessionId: '00000000-0000-4000-8000-00000000000a',
      onNewConversation
    })
    await screen.findByText('Ativa')

    fireEvent.click(screen.getByLabelText('Excluir Ativa'))
    fireEvent.click(screen.getByText('Excluir'))

    await waitFor(() => expect(onNewConversation).toHaveBeenCalledTimes(1))
  })

  it('moves focus down the rows with the arrow keys', async () => {
    renderSidebar([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Primeira' }),
      meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Segunda' })
    ])
    await screen.findByText('Primeira')

    const rows = screen.getAllByLabelText(/^Abrir conversa:/)
    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1])
    fireEvent.keyDown(rows[1], { key: 'Home' })
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'End' })
    expect(document.activeElement).toBe(rows[1])
  })

  it('keeps editing keys in the title input and restores focus on Escape', async () => {
    const chatHistory = renderSidebar([
      meta({ id: 'first', title: 'Primeira' }),
      meta({ id: 'second', title: 'Segunda' })
    ])
    await screen.findByText('Primeira')
    fireEvent.click(screen.getByLabelText('Renomear Primeira'))
    const input = screen.getByLabelText('Título da conversa')
    for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown']) {
      fireEvent.keyDown(input, { key })
      expect(document.activeElement).toBe(input)
    }
    fireEvent.change(input, { target: { value: 'Rascunho cancelado' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(chatHistory.rename).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText('Abrir conversa: Primeira'))
  })

  it('Escape cancels inline deletion without deleting or losing keyboard focus', async () => {
    const chatHistory = renderSidebar([meta({ title: 'Fica' })])
    await screen.findByText('Fica')
    fireEvent.click(screen.getByLabelText('Excluir Fica'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Excluir' }), { key: 'Escape' })
    expect(chatHistory.delete).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText('Abrir conversa: Fica'))
  })

  it('reports rename and deletion failures while preserving the conversation', async () => {
    const chatHistory = renderSidebar([meta({ title: 'Preservada' })])
    chatHistory.rename.mockRejectedValue(new Error('EACCES'))
    chatHistory.delete.mockRejectedValue(new Error('EACCES'))
    await screen.findByText('Preservada')
    fireEvent.click(screen.getByLabelText('Renomear Preservada'))
    fireEvent.change(screen.getByLabelText('Título da conversa'), {
      target: { value: 'Outro nome' }
    })
    fireEvent.keyDown(screen.getByLabelText('Título da conversa'), { key: 'Enter' })
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Não foi possível renomear a conversa. Tente novamente.'
    )
    expect(screen.getByText('Preservada')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Excluir Preservada'))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Não foi possível excluir a conversa. Tente novamente.'
      )
    )
    expect(screen.getByText('Preservada')).toBeTruthy()
  })

  it('sessionTitle falls back to the untitled label', () => {
    expect(sessionTitle({ title: '' })).toBe('Conversa sem título')
    expect(sessionTitle({ title: 'Com título' })).toBe('Com título')
  })

  /**
   * Multi-select and bulk delete.
   *
   * One row at a time was the only way to clear a history, and a history is
   * exactly the kind of list that accumulates a dozen throwaway threads. The
   * gestures here are the ones every file manager already taught — a tick box,
   * Shift for a range, Ctrl for one more — because a list that invents its own
   * is a list people learn twice.
   */
  describe('selecting more than one conversation', () => {
    const ids = [
      '00000000-0000-4000-8000-00000000000a',
      '00000000-0000-4000-8000-00000000000b',
      '00000000-0000-4000-8000-00000000000c'
    ]

    function renderThree(): HistoryMock {
      return renderSidebar([
        meta({ id: ids[0], title: 'Primeira', updatedAt: Date.now() - 1_000 }),
        meta({ id: ids[1], title: 'Segunda', updatedAt: Date.now() - 2_000 }),
        meta({ id: ids[2], title: 'Terceira', updatedAt: Date.now() - 3_000 })
      ])
    }

    it('ticks a row and raises the bar that says how many', async () => {
      renderThree()
      await screen.findByText('Primeira')
      // No bar until something is ticked: a toolbar over a list nobody has
      // selected in is furniture.
      expect(screen.queryByRole('group', { name: /selecionada/ })).toBeNull()

      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      const bar = await screen.findByRole('group', { name: '1 conversa selecionada' })
      // The visible count is short so it survives a 280px column; the
      // accessible name is the whole sentence.
      expect(bar.textContent).toContain('1 selecionada')
      expect(screen.getByLabelText('Tirar Primeira da seleção').getAttribute('aria-checked')).toBe(
        'true'
      )
    })

    it('extends a range with Shift, from the row last touched', async () => {
      renderThree()
      await screen.findByText('Primeira')

      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByLabelText('Selecionar Terceira'), { shiftKey: true })

      expect(await screen.findByRole('group', { name: '3 conversas selecionadas' })).toBeTruthy()
    })

    it('ticks a row with Ctrl-click instead of opening it', async () => {
      const onOpenSession = vi.fn()
      renderSidebar([meta({ id: ids[0], title: 'Primeira' })], { onOpenSession })
      await screen.findByText('Primeira')

      fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa: Primeira' }), {
        ctrlKey: true
      })
      expect(onOpenSession).not.toHaveBeenCalled()
      expect(await screen.findByRole('group', { name: '1 conversa selecionada' })).toBeTruthy()

      // …and a plain click still opens, which is the gesture 95% of visits use.
      fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa: Primeira' }))
      expect(onOpenSession).toHaveBeenCalledWith(ids[0])
    })

    it('select-all is tri-state: some, then all, then none', async () => {
      renderThree()
      await screen.findByText('Primeira')
      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))

      const all = screen.getByLabelText('Selecionar todas as conversas da lista')
      // "some" must not render as unchecked — the bar would be claiming nothing
      // is selected while a row sits highlighted under it.
      expect(all.getAttribute('aria-checked')).toBe('mixed')

      fireEvent.click(all)
      expect(await screen.findByRole('group', { name: '3 conversas selecionadas' })).toBeTruthy()
      expect(
        screen.getByLabelText('Selecionar todas as conversas da lista').getAttribute('aria-checked')
      ).toBe('true')

      fireEvent.click(screen.getByLabelText('Selecionar todas as conversas da lista'))
      await waitFor(() => expect(screen.queryByRole('group', { name: /selecionada/ })).toBeNull())
    })

    it('asks before deleting, says how many, and deletes them together', async () => {
      const chatHistory = renderThree()
      await screen.findByText('Primeira')
      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByLabelText('Selecionar Segunda'))

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      expect(chatHistory.delete).not.toHaveBeenCalled()
      // The number is the only defence against deleting more than intended.
      expect(await screen.findByText('Excluir 2 conversas?')).toBeTruthy()

      fireEvent.click(screen.getByText('Excluir'))
      await waitFor(() => expect(chatHistory.delete).toHaveBeenCalledTimes(2))
      expect(chatHistory.delete).toHaveBeenCalledWith('/ws', ids[0])
      expect(chatHistory.delete).toHaveBeenCalledWith('/ws', ids[1])
      await waitFor(() => expect(screen.queryByText('Primeira')).toBeNull())
      expect(screen.getByText('Terceira')).toBeTruthy()
      // The bar goes with the selection it was about.
      expect(screen.queryByRole('group', { name: /selecionada/ })).toBeNull()
    })

    it('cancelling the question keeps every conversation and the selection', async () => {
      const chatHistory = renderThree()
      await screen.findByText('Primeira')
      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      fireEvent.click(screen.getByText('Cancelar'))

      expect(chatHistory.delete).not.toHaveBeenCalled()
      expect(screen.getByText('Primeira')).toBeTruthy()
      expect(await screen.findByRole('group', { name: '1 conversa selecionada' })).toBeTruthy()
    })

    /** A question about two rows is not a question about three. */
    it('retracts the question when the selection changes under it', async () => {
      renderThree()
      await screen.findByText('Primeira')
      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      expect(await screen.findByText('Excluir 1 conversa?')).toBeTruthy()

      fireEvent.click(screen.getByLabelText('Selecionar Segunda'))
      await waitFor(() => expect(screen.queryByText('Excluir 1 conversa?')).toBeNull())
      expect(screen.getByRole('button', { name: 'Excluir' })).toBeTruthy()
    })

    it('leaves the selection with the ✕ and with Escape', async () => {
      renderThree()
      await screen.findByText('Primeira')
      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByLabelText('Sair da seleção'))
      await waitFor(() => expect(screen.queryByRole('group', { name: /selecionada/ })).toBeNull())

      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      expect(await screen.findByRole('group', { name: '1 conversa selecionada' })).toBeTruthy()
      fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir conversa: Primeira' }), {
        key: 'Escape'
      })
      await waitFor(() => expect(screen.queryByRole('group', { name: /selecionada/ })).toBeNull())
    })

    /**
     * Space is the keyboard's half of the tick box, and it must not also open
     * the conversation — a row is a `<button>`, and a button activates on
     * Space's key-up unless the key-down is cancelled.
     */
    it('ticks the focused row with Space, without opening it', async () => {
      const onOpenSession = vi.fn()
      renderSidebar([meta({ id: ids[0], title: 'Primeira' })], { onOpenSession })
      await screen.findByText('Primeira')

      const row = screen.getByRole('button', { name: 'Abrir conversa: Primeira' })
      row.focus()
      fireEvent.keyDown(row, { key: ' ' })

      expect(await screen.findByRole('group', { name: '1 conversa selecionada' })).toBeTruthy()
      expect(onOpenSession).not.toHaveBeenCalled()
    })

    /**
     * The window, the order and the search box all move under a selection. A
     * tick that outlived its row would be a conversation the next "Excluir 2"
     * removes without ever having shown it.
     */
    it('forgets ticks whose rows the window has taken off screen', async () => {
      const chatHistory = renderSidebar([
        meta({ id: ids[0], title: 'Recente', updatedAt: Date.now() - 1_000 }),
        meta({ id: ids[1], title: 'Antiga', updatedAt: Date.now() - 10 * DAY })
      ])
      await screen.findByText('Antiga')
      fireEvent.click(screen.getByLabelText('Selecionar Antiga'))
      fireEvent.click(screen.getByLabelText('Selecionar Recente'))
      expect(await screen.findByRole('group', { name: '2 conversas selecionadas' })).toBeTruthy()

      // Narrowing the window drops one of the ticked rows off the list.
      pick(/^Filtrar por última atividade/, '1 dia')
      await waitFor(() => expect(screen.queryByText('Antiga')).toBeNull())
      expect(screen.getByRole('group', { name: '1 conversa selecionada' })).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      expect(await screen.findByText('Excluir 1 conversa?')).toBeTruthy()
      fireEvent.click(screen.getByText('Excluir'))
      await waitFor(() => expect(chatHistory.delete).toHaveBeenCalledTimes(1))
      // The one still on screen — never the one the filter hid.
      expect(chatHistory.delete).toHaveBeenCalledWith('/ws', ids[0])
    })

    /** A failure that takes only some of them says so, and keeps the survivors. */
    it('reports a partial failure instead of pretending they all went', async () => {
      const chatHistory = renderThree()
      await screen.findByText('Primeira')
      chatHistory.delete.mockImplementation((_ws: string, id: string) =>
        id === ids[1] ? Promise.reject(new Error('EBUSY')) : Promise.resolve(undefined)
      )

      fireEvent.click(screen.getByLabelText('Selecionar Primeira'))
      fireEvent.click(screen.getByLabelText('Selecionar Segunda'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      fireEvent.click(screen.getByText('Excluir'))

      expect(
        await screen.findByText('Não foi possível excluir a conversa. Tente novamente.')
      ).toBeTruthy()
      await waitFor(() => expect(screen.queryByText('Primeira')).toBeNull())
      expect(screen.getByText('Segunda')).toBeTruthy()
    })

    /** The open transcript cannot outlive the conversation it belongs to. */
    it('resets the pane when the deleted set includes the conversation on screen', async () => {
      const onNewConversation = vi.fn()
      const chatHistory = mockChatHistory([
        meta({ id: ids[0], title: 'Primeira' }),
        meta({ id: ids[1], title: 'Segunda' })
      ])
      render(createElement(Harness, { activeSessionId: ids[1], onNewConversation }))
      await screen.findByText('Segunda')

      fireEvent.click(screen.getByLabelText('Selecionar Segunda'))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      fireEvent.click(screen.getByText('Excluir'))

      await waitFor(() => expect(chatHistory.delete).toHaveBeenCalledWith('/ws', ids[1]))
      await waitFor(() => expect(onNewConversation).toHaveBeenCalled())
    })
  })
})

describe('NewConversationButton', () => {
  afterEach(cleanup)

  it('shows the short word and names the whole action', () => {
    const onClick = vi.fn()
    render(createElement(NewConversationButton, { onClick }))
    const button = screen.getByRole('button', { name: 'Novo — iniciar uma nova conversa' })
    // WCAG 2.5.3: the accessible name contains the visible text, so a voice
    // user saying what they read reaches the control they are looking at.
    expect(button.textContent).toBe('Novo')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('AllConversationsDialog — the archive', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function renderDialog(
    sessions: ChatSessionMeta[],
    overrides: {
      open?: boolean
      onOpenChange?: (open: boolean) => void
      onOpenSession?: (id: string) => void
    } = {}
  ): HistoryMock {
    const chatHistory = mockChatHistory(sessions)
    render(
      createElement(DialogHarness, {
        open: overrides.open ?? true,
        onOpenChange: overrides.onOpenChange ?? vi.fn(),
        workspace: '/ws',
        activeSessionId: null,
        window: 'all',
        sort: 'activity',
        onWindowChange: vi.fn(),
        onSortChange: vi.fn(),
        onOpenSession: overrides.onOpenSession ?? vi.fn(),
        onNewConversation: vi.fn()
      })
    )
    return chatHistory
  }

  it('mounts nothing — and reads nothing — while closed', () => {
    const chatHistory = renderDialog([meta({})], { open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chatHistory.list).not.toHaveBeenCalled()
  })

  it('lists every conversation with a count', async () => {
    renderDialog([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Uma' }),
      meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Outra' })
    ])
    expect(await screen.findByText('Uma')).toBeTruthy()
    expect(screen.getByText('2 conversas')).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByText('Todas as conversas')).toBeTruthy()
  })

  it('search filters by title/preview and reports no-match', async () => {
    renderDialog([
      meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'PRD financeiro' }),
      meta({ id: '00000000-0000-4000-8000-00000000000b', title: 'Brainstorm de onboarding' })
    ])
    await screen.findByText('PRD financeiro')

    const search = screen.getByPlaceholderText('Buscar conversas…')
    fireEvent.change(search, { target: { value: 'brainstorm' } })
    expect(screen.queryByText('PRD financeiro')).toBeNull()
    expect(screen.getByText('Brainstorm de onboarding')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('Nada encontrado para "zzz".')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Limpar busca'))
    expect(await screen.findByText('PRD financeiro')).toBeTruthy()
  })

  // A hit inside a message body is invisible to the local title/preview filter;
  // it arrives via the debounced IPC search and shows its matched snippet.
  it('full-text search surfaces message-body hits with a snippet', async () => {
    const target = meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Sem relação' })
    const chatHistory = renderDialog([target])
    chatHistory.search.mockResolvedValue([
      { ...target, match: '…retentativa em cascata para pagamentos…' }
    ])
    await screen.findByText('Sem relação')

    fireEvent.change(screen.getByPlaceholderText('Buscar conversas…'), {
      target: { value: 'cascata' }
    })

    expect(await screen.findByText('…retentativa em cascata para pagamentos…')).toBeTruthy()
    expect(chatHistory.search).toHaveBeenCalledWith('/ws', 'cascata')
  })

  it('opening a row closes the archive and hands the id up', async () => {
    const onOpenChange = vi.fn()
    const onOpenSession = vi.fn()
    renderDialog([meta({ id: '00000000-0000-4000-8000-00000000000a', title: 'Escolhida' })], {
      onOpenChange,
      onOpenSession
    })
    fireEvent.click(await screen.findByText('Escolhida'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenSession).toHaveBeenCalledWith('00000000-0000-4000-8000-00000000000a')
  })

  it('closes from its own close button', async () => {
    const onOpenChange = vi.fn()
    renderDialog([meta({})], { onOpenChange })
    await screen.findByText('Conversa qualquer')
    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape dismisses deletion, then the search, then the archive', async () => {
    const onOpenChange = vi.fn()
    const chatHistory = renderDialog([meta({ title: 'Histórico' })], { onOpenChange })
    await screen.findByText('Histórico')
    const search = screen.getByPlaceholderText('Buscar conversas…')
    fireEvent.change(search, { target: { value: 'Histórico' } })
    fireEvent.click(screen.getByLabelText('Excluir Histórico'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Excluir' }), { key: 'Escape' })
    expect(chatHistory.delete).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(search).toHaveProperty('value', 'Histórico')
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search).toHaveProperty('value', '')
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shares rename/delete and filters with the sidebar without sharing search visibility', async () => {
    const first = meta({ id: 'a', title: 'Uma conversa' })
    const second = meta({ id: 'b', title: 'Outra conversa' })
    const chatHistory = mockChatHistory([first, second])
    render(createElement(SharedHistoryHarness))
    const sidebar = within(screen.getByTestId('sidebar'))
    const archive = within(screen.getByRole('dialog'))
    await archive.findByText('Uma conversa')

    fireEvent.click(archive.getByLabelText('Renomear Uma conversa'))
    fireEvent.change(archive.getByLabelText('Título da conversa'), {
      target: { value: 'Nome atualizado' }
    })
    fireEvent.keyDown(archive.getByLabelText('Título da conversa'), { key: 'Enter' })
    await sidebar.findByText('Nome atualizado')
    expect(archive.getByText('Nome atualizado')).toBeTruthy()

    fireEvent.change(archive.getByPlaceholderText('Buscar conversas…'), {
      target: { value: 'Outra' }
    })
    expect(archive.queryByText('Nome atualizado')).toBeNull()
    expect(sidebar.getByText('Nome atualizado')).toBeTruthy()
    fireEvent.click(archive.getByLabelText('Excluir Outra conversa'))
    fireEvent.click(archive.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(sidebar.queryByText('Outra conversa')).toBeNull())

    fireEvent.click(archive.getByRole('button', { name: /^Ordenar conversas/ }))
    fireEvent.click(archive.getByRole('menuitemradio', { name: 'Nome' }))
    expect(sidebar.getByRole('button', { name: 'Ordenar conversas: Nome' })).toBeTruthy()
    chatHistory.list.mockResolvedValue([{ ...first, title: 'Nome atualizado' }])
    fireEvent.click(archive.getByLabelText('Fechar'))
    fireEvent.click(sidebar.getByText('Ver todas as conversas'))
    expect(screen.getByPlaceholderText('Buscar conversas…')).toHaveProperty('value', '')
    expect(await within(screen.getByRole('dialog')).findByText('Nome atualizado')).toBeTruthy()
  })

  /**
   * A failed search belongs to the surface that owns the search box. The
   * sidebar has no search field, so raising the archive's failure there would
   * put an error over a list that is perfectly fine — while a failed *write*,
   * which both surfaces made, has to show up in both.
   */
  it('keeps a failed search inside the archive, but reports a failed deletion in both', async () => {
    const chatHistory = mockChatHistory([meta({ id: 'a', title: 'Uma conversa' })])
    chatHistory.search.mockRejectedValue(new Error('index'))
    render(createElement(SharedHistoryHarness))
    const sidebar = within(screen.getByTestId('sidebar'))
    const archive = within(screen.getByRole('dialog'))
    await archive.findByText('Uma conversa')

    fireEvent.change(archive.getByPlaceholderText('Buscar conversas…'), {
      target: { value: 'qualquer' }
    })
    expect(
      await archive.findByText(/Não foi possível buscar no conteúdo das conversas/)
    ).toBeTruthy()
    expect(sidebar.queryByText(/Não foi possível buscar no conteúdo/)).toBeNull()
    expect(sidebar.getByText('Uma conversa')).toBeTruthy()

    // Back out of the search so the row is on screen again: a failed *write*
    // is the case that has to reach both surfaces.
    fireEvent.change(archive.getByPlaceholderText('Buscar conversas…'), { target: { value: '' } })
    chatHistory.delete.mockRejectedValue(new Error('EACCES'))
    fireEvent.click(await archive.findByLabelText('Excluir Uma conversa'))
    fireEvent.click(archive.getByRole('button', { name: 'Excluir' }))
    expect(await sidebar.findByText(/Não foi possível excluir a conversa/)).toBeTruthy()
    expect(sidebar.getByText('Uma conversa')).toBeTruthy()
  })

  /**
   * The archive's own way out of a window it just emptied. The sidebar ships
   * the same undo; this asserts the wide surface does not drop it, because an
   * empty archive with no visible cause is where a user concludes the history
   * is gone.
   */
  it('offers the way out of an empty window from the archive, and it moves the sidebar too', async () => {
    mockChatHistory([meta({ id: 'a', title: 'Antiga', updatedAt: Date.now() - 10 * DAY })])
    render(createElement(SharedHistoryHarness))
    const sidebar = within(screen.getByTestId('sidebar'))
    const archive = within(screen.getByRole('dialog'))
    await archive.findByText('Antiga')

    fireEvent.click(archive.getByRole('button', { name: /^Filtrar por última atividade/ }))
    fireEvent.click(archive.getByRole('menuitemradio', { name: '1 dia' }))
    expect(archive.queryByText('Antiga')).toBeNull()
    expect(sidebar.queryByText('Antiga')).toBeNull()

    fireEvent.click(archive.getByText('Ver todos os períodos'))
    expect(await archive.findByText('Antiga')).toBeTruthy()
    // The lens is lifted, so clearing it in one place clears it in the other.
    expect(sidebar.getByText('Antiga')).toBeTruthy()
    expect(
      sidebar.getByRole('button', { name: 'Filtrar por última atividade: Todos' })
    ).toBeTruthy()
  })
})

/**
 * initiatives: a conversation started inside a demand carries that demand into
 * the history — as a badge that names it, and as something the list can be
 * narrowed to.
 */
describe('ChatSidebar — conversations that belong to a demand', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const TESTES = 'docs/iniciativas/R1/testes'
  const PORTAL = 'docs/iniciativas/R2/portal'
  const MARKS = {
    [TESTES]: { title: 'Testes', color: 'violet' as const },
    [PORTAL]: { title: 'Portal', color: 'sky' as const }
  }
  const OPTIONS = [
    { path: TESTES, title: 'R1 · Testes' },
    { path: PORTAL, title: 'R2 · Portal' }
  ]
  const ROWS = [
    meta({
      id: '00000000-0000-4000-8000-00000000000a',
      title: 'PRD dos testes',
      initiativePath: TESTES
    }),
    meta({
      id: '00000000-0000-4000-8000-00000000000b',
      title: 'Arquitetura do portal',
      initiativePath: PORTAL
    }),
    meta({ id: '00000000-0000-4000-8000-00000000000c', title: 'Conversa solta' })
  ]

  it('badges a row with the demand’s name, in the demand’s colour', async () => {
    renderSidebar(ROWS, { initiativeMarks: MARKS, initiativeOptions: OPTIONS })
    await screen.findByText('PRD dos testes')
    const badge = document.querySelector('.wb-init-badge')
    // The NAME is in the pill. Colour makes the set scannable; it is never what
    // makes it readable.
    expect(badge?.textContent).toBe('Testes')
    expect(badge?.getAttribute('style')).toContain('--init-hue: var(--init-violet)')
  })

  it('leaves a conversation that belongs to no demand unbadged', async () => {
    renderSidebar(ROWS, { initiativeMarks: MARKS, initiativeOptions: OPTIONS })
    await screen.findByText('Conversa solta')
    expect(document.querySelectorAll('.wb-init-badge')).toHaveLength(2)
  })

  it('narrows the list to one demand', async () => {
    renderSidebar(ROWS, { initiativeMarks: MARKS, initiativeOptions: OPTIONS })
    await screen.findByText('PRD dos testes')
    pick(/Filtrar conversas por iniciativa/, 'R1 · Testes')
    expect(screen.getByText('PRD dos testes')).toBeTruthy()
    expect(screen.queryByText('Arquitetura do portal')).toBeNull()
    expect(screen.queryByText('Conversa solta')).toBeNull()
  })

  it('can ask for the ones that belong to no demand at all', async () => {
    renderSidebar(ROWS, { initiativeMarks: MARKS, initiativeOptions: OPTIONS })
    await screen.findByText('PRD dos testes')
    pick(/Filtrar conversas por iniciativa/, 'Sem iniciativa')
    expect(screen.getByText('Conversa solta')).toBeTruthy()
    expect(screen.queryByText('PRD dos testes')).toBeNull()
  })

  it('offers no filter at all in a workspace with no demands', async () => {
    renderSidebar(ROWS)
    await screen.findByText('Conversa solta')
    // A control whose every option is "todas" teaches a feature this workspace
    // is not using, in the narrowest column of the app.
    expect(screen.queryByRole('button', { name: /Filtrar conversas por iniciativa/ })).toBeNull()
  })
})
