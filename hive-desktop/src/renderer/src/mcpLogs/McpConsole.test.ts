// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { McpConsole } from './McpConsole'
import { McpStatusCluster } from './McpStatusCluster'
import type { McpLogEntry, McpLogKind, McpLogLevel } from './logConsole'
import type { McpRosterEntry } from './mcpRoster'

/**
 * `McpConsole` / `McpStatusCluster` component tests — the wiring between the
 * decisions `logConsole.test.ts` already pins and what ends up on screen: that
 * the filters and search actually narrow the stream, that a detail block stays
 * collapsed until asked for, that each of the four states shows the right way
 * out, and that the rail's server selection scopes the stream.
 */

let seq = 0

function entry(overrides: Partial<McpLogEntry> = {}): McpLogEntry {
  seq += 1
  return {
    id: `f#${seq}`,
    server: 'playwright',
    at: Date.parse('2026-08-06T16:41:18Z') + seq * 1000,
    level: 'info' as McpLogLevel,
    kind: 'notice' as McpLogKind,
    text: `evento ${seq}`,
    detail: '',
    sessionId: 's1',
    tool: null,
    durationMs: null,
    transport: null,
    serverVersion: null,
    raw: `{"n":${seq}}`,
    ...overrides
  }
}

const onClose = vi.fn()
const onOpenManager = vi.fn()
const reload = vi.fn()
const openDir = vi.fn()

/** Renders the console around a given set of entries. */
function renderConsole(
  entries: McpLogEntry[],
  store: {
    loading?: boolean
    error?: string | null
    catalog?: string[]
    roster?: McpRosterEntry[]
    location?: { dir: string; exists: boolean } | null
  } = {}
): void {
  render(
    createElement(McpConsole, {
      workspace: '/ws',
      catalog: store.catalog ?? ['playwright'],
      roster: store.roster ?? [],
      live: true,
      onClose,
      onOpenManager,
      store: {
        entries,
        sources: [{ server: 'playwright', dir: '/d', files: 1, lastActivityAt: 1 }],
        location:
          store.location === undefined ? { dir: '/cache/ws', exists: true } : store.location,
        loading: store.loading ?? false,
        error: store.error ?? null,
        freshIds: new Set<string>(),
        reload
      }
    })
  )
}

/** Every event row's visible summary text, in order. */
function rowTexts(): string[] {
  return Array.from(document.querySelectorAll('.wb-mcplog-text')).map(
    (node) => node.textContent ?? ''
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { hive: unknown }).hive = { mcpLogs: { openDir } }
})

afterEach(() => cleanup())

describe('McpConsole — the stream', () => {
  it('renders one row per event, oldest first, with its wall-clock time', () => {
    renderConsole([entry({ text: 'primeiro' }), entry({ text: 'segundo' })])
    expect(rowTexts()).toEqual(['primeiro', 'segundo'])
    expect(document.querySelectorAll('.wb-mcplog-time')[0].textContent).toMatch(
      /^\d{2}:\d{2}:\d{2}$/
    )
  })

  it('leads a tool row with the tool name and its latency', () => {
    renderConsole([entry({ kind: 'tool-ok', tool: 'browser_navigate', durationMs: 1400 })])
    expect(screen.getByText('browser_navigate')).toBeTruthy()
    expect(screen.getByText('1,4 s')).toBeTruthy()
  })

  it('scales the duration bar against the slowest call in view', () => {
    renderConsole([
      entry({ kind: 'tool-ok', tool: 'rapida', durationMs: 250 }),
      entry({ kind: 'tool-ok', tool: 'lenta', durationMs: 1000 })
    ])
    const fills = Array.from(document.querySelectorAll<HTMLElement>('.wb-mcplog-meter-fill'))
    expect(fills).toHaveLength(2)
    expect(fills[0].style.transform).toBe('scaleX(0.25)')
    expect(fills[1].style.transform).toBe('scaleX(1)')
  })

  it('draws no bar for an event whose duration is not comparable work', () => {
    renderConsole([entry({ kind: 'connected', transport: 'stdio', durationMs: 2300 })])
    expect(screen.getByText('2,3 s')).toBeTruthy()
    expect(document.querySelector('.wb-mcplog-meter')).toBeNull()
  })

  it('breaks the stream into one band per session', () => {
    renderConsole([entry({ sessionId: 'a' }), entry({ sessionId: 'a' }), entry({ sessionId: 'b' })])
    expect(document.querySelectorAll('.wb-mcplog-band')).toHaveLength(2)
    expect(screen.getByText('2 eventos')).toBeTruthy()
    expect(screen.getByText('1 evento')).toBeTruthy()
  })

  it('keeps a stack trace collapsed until the row is opened', () => {
    renderConsole([
      entry({ kind: 'tool-failed', level: 'error', text: 'TimeoutError', detail: 'at foo.ts:1' })
    ])
    expect(screen.queryByText('at foo.ts:1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de: TimeoutError' }))
    expect(screen.getByText('at foo.ts:1')).toBeTruthy()
  })

  it('offers no disclosure control for a row with nothing more to show', () => {
    renderConsole([entry({ text: 'simples' })])
    expect(screen.queryByRole('button', { name: /Ver detalhes/ })).toBeNull()
  })

  it('copies the original log line, not the rendered sentence', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderConsole([entry({ kind: 'tool-ok', tool: 'x', raw: '{"debug":"cru"}' })])
    fireEvent.click(screen.getByRole('button', { name: 'Copiar o registro bruto deste evento' }))
    expect(writeText).toHaveBeenCalledWith('{"debug":"cru"}')
  })
})

describe('McpConsole — filters', () => {
  const mixed = [
    entry({ kind: 'tool-call', tool: 'browser_navigate' }),
    entry({ kind: 'connected', transport: 'stdio' }),
    entry({ kind: 'stderr', level: 'error', text: 'boom' })
  ]

  it('tallies every view, whichever one is active', () => {
    renderConsole(mixed)
    expect(screen.getByRole('radio', { name: 'Tudo 3' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Ferramentas 1' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Conexão 1' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Problemas 1' })).toBeTruthy()
  })

  it('narrows the stream to the chosen view', () => {
    renderConsole(mixed)
    fireEvent.click(screen.getByRole('radio', { name: /Ferramentas/ }))
    expect(rowTexts()).toEqual(['browser_navigate'])
  })

  it('narrows the stream by search', () => {
    renderConsole(mixed)
    fireEvent.change(screen.getByLabelText('Buscar nos eventos'), { target: { value: 'boom' } })
    expect(rowTexts()).toEqual(['boom'])
  })

  it('teaches the way out when a filter matches nothing, and clears it', () => {
    renderConsole(mixed)
    fireEvent.change(screen.getByLabelText('Buscar nos eventos'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhum evento neste filtro')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(rowTexts()).toHaveLength(3)
  })
})

describe('McpConsole — states', () => {
  it('shows a spinner while history is still being read', () => {
    renderConsole([], { loading: true })
    expect(screen.getByText('Lendo a atividade MCP…')).toBeTruthy()
  })

  it('teaches what the console is for when nothing has ever run, and points at the manager', () => {
    renderConsole([])
    expect(screen.getByText('Nenhuma atividade MCP ainda')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Configurar servidores MCP' }))
    expect(onOpenManager).toHaveBeenCalled()
  })

  it('offers a retry on a read failure', () => {
    renderConsole([], { error: 'sem permissão' })
    expect(screen.getByText('Não foi possível ler a atividade MCP')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reload).toHaveBeenCalled()
  })
})

describe('McpConsole — chrome', () => {
  it('closes on the close control', () => {
    renderConsole([entry()])
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o console MCP' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the live badge only while events are arriving', () => {
    renderConsole([entry()])
    expect(screen.getByText('ao vivo')).toBeTruthy()
  })

  it('reveals the per-server rail only once maximized', () => {
    renderConsole([entry({ kind: 'tool-call', tool: 'x' })])
    expect(screen.queryByRole('complementary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o console para a área toda' }))
    expect(screen.getByRole('complementary', { name: 'Servidores' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restaurar a altura do console' })).toBeTruthy()
  })

  it('scopes the stream to the server picked in the rail, and back off', () => {
    renderConsole([
      entry({ server: 'playwright', text: 'de pw' }),
      entry({ server: 'pencil', text: 'de pencil' })
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o console para a área toda' }))
    const rail = screen.getByRole('complementary', { name: 'Servidores' })

    fireEvent.click(within(rail).getByText('pencil'))
    expect(rowTexts()).toEqual(['de pencil'])

    fireEvent.click(within(rail).getByText('pencil'))
    expect(rowTexts()).toHaveLength(2)
  })

  it('flags a server that logs here but is not in this workspace catalog', () => {
    renderConsole([entry({ server: 'pencil' })], { catalog: ['playwright'] })
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o console para a área toda' }))
    expect(screen.getByText('fora do .mcp.json deste workspace')).toBeTruthy()
  })

  it('hands the log folder to the OS from the rail', () => {
    renderConsole([entry({ server: 'pencil' })])
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o console para a área toda' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a pasta de logs de pencil' }))
    expect(openDir).toHaveBeenCalledWith('/ws', 'pencil')
  })
})

/**
 * mcp-visibility: the roster strip and the diagnostic empty state — the two
 * places the console stopped being able to say "you have no MCP servers" when
 * what it meant was "I found no log files".
 */
describe('McpConsole — roster strip', () => {
  const rosterEntry = (over: Partial<McpRosterEntry> = {}): McpRosterEntry => ({
    name: 'playwright',
    key: 'playwright',
    state: 'connected',
    tools: ['a', 'b'],
    inCatalog: true,
    lastAt: 1,
    calls: 0,
    errors: 0,
    ...over
  })

  it('shows every known server even when the stream below is empty', () => {
    renderConsole([], { roster: [rosterEntry(), rosterEntry({ name: 'pencil', key: 'pencil' })] })
    const pills = document.querySelectorAll('.wb-mcplog-pill')
    expect(
      Array.from(pills).map((pill) => pill.querySelector('.wb-mcplog-pill-name')?.textContent)
    ).toEqual(['playwright', 'pencil'])
    // And the empty state is still the one on screen — the strip does not
    // pretend there is activity.
    expect(screen.getByText('Nenhuma atividade MCP ainda')).toBeTruthy()
  })

  it('renders no strip at all when the workspace has no servers', () => {
    renderConsole([entry()], { roster: [] })
    expect(document.querySelector('.wb-mcplog-strip')).toBeNull()
  })

  it('scopes the stream to a server, and lets the same pill clear it', () => {
    renderConsole(
      [entry({ server: 'playwright' }), entry({ server: 'pencil', text: 'do lápis' })],
      {
        roster: [rosterEntry(), rosterEntry({ name: 'pencil', key: 'pencil' })]
      }
    )
    const pill = screen.getByRole('button', { name: /^playwright/ })

    fireEvent.click(pill)
    expect(pill.getAttribute('aria-pressed')).toBe('true')
    expect(rowTexts()).not.toContain('do lápis')

    fireEvent.click(pill)
    expect(pill.getAttribute('aria-pressed')).toBe('false')
    expect(rowTexts()).toContain('do lápis')
  })

  it('carries the state word and the tool count on the pill', () => {
    renderConsole([], { roster: [rosterEntry({ state: 'failed', tools: ['a', 'b', 'c'] })] })
    const pill = document.querySelector('.wb-mcplog-pill')
    expect(pill?.getAttribute('data-state')).toBe('failed')
    expect(pill?.querySelector('.wb-mcplog-pill-state')?.textContent).toBe('falhou')
    expect(pill?.querySelector('.wb-mcplog-pill-count')?.textContent).toBe('3')
  })
})

describe('McpConsole — where the logs were read from', () => {
  it('names the directory on the nothing-yet state, and says it is missing', () => {
    renderConsole([], { location: { dir: '/cache/claude-cli-nodejs/-ws', exists: false } })
    expect(screen.getByText('Ainda não existe')).toBeTruthy()
    expect(screen.getByText('/cache/claude-cli-nodejs/-ws')).toBeTruthy()
  })

  it('says it is reading when the directory does exist', () => {
    renderConsole([], { location: { dir: '/cache/x', exists: true } })
    expect(screen.getByText('Lendo de')).toBeTruthy()
  })

  it('shows no path on the wrong-filter state — the filter is the problem there', () => {
    renderConsole([entry({ server: 'pencil' })], { location: { dir: '/cache/x', exists: true } })
    fireEvent.change(screen.getByLabelText('Buscar nos eventos'), {
      target: { value: 'zzz-nada' }
    })
    expect(screen.getByText('Nenhum evento neste filtro')).toBeTruthy()
    expect(document.querySelector('.wb-mcplog-source')).toBeNull()
  })
})

describe('McpStatusCluster', () => {
  const rosterEntry = (over: Partial<McpRosterEntry> = {}): McpRosterEntry => ({
    name: 'playwright',
    key: 'playwright',
    state: 'connected',
    tools: ['browser_navigate'],
    inCatalog: true,
    lastAt: 1,
    calls: 0,
    errors: 0,
    ...over
  })

  it("counts the workspace's servers rather than naming whoever spoke last", () => {
    render(
      createElement(McpStatusCluster, {
        roster: [rosterEntry(), rosterEntry({ name: 'pencil', key: 'pencil' })],
        live: true,
        open: false,
        onToggle: vi.fn()
      })
    )
    expect(screen.getByText('2 servidores MCP')).toBeTruthy()
    expect(document.querySelector('.wb-status-mcp-pulse')).toBeTruthy()
  })

  it('lists every server, its state and its tool count in the roster card', () => {
    render(
      createElement(McpStatusCluster, {
        roster: [
          rosterEntry({ tools: ['a', 'b', 'c'] }),
          rosterEntry({ name: 'pencil', key: 'pencil', state: 'known', tools: null })
        ],
        live: false,
        open: false,
        onToggle: vi.fn()
      })
    )
    expect(screen.getByText('playwright')).toBeTruthy()
    expect(screen.getByText('3 ferramentas')).toBeTruthy()
    expect(screen.getByText('conectado')).toBeTruthy()
    // A server with no reported tool list shows no count at all rather than a zero.
    expect(screen.queryByText('0 ferramentas')).toBeNull()
  })

  it('stays quiet with nothing to report — a label, not a zero', () => {
    render(
      createElement(McpStatusCluster, {
        roster: [],
        live: false,
        open: false,
        onToggle: vi.fn()
      })
    )
    expect(screen.getByText('Nenhum servidor MCP')).toBeTruthy()
    expect(document.querySelector('.wb-status-mcp-errors')).toBeNull()
    expect(document.querySelector('.wb-status-mcp-pulse')).toBeNull()
  })

  it('goes loud only for failures, and reports the dock state', () => {
    const onToggle = vi.fn()
    render(
      createElement(McpStatusCluster, {
        roster: [
          rosterEntry({ state: 'failed' }),
          rosterEntry({ name: 'pencil', key: 'pencil', state: 'connected' })
        ],
        live: false,
        open: true,
        onToggle
      })
    )
    expect(screen.getByText('1 de 2 com falha')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    const button = screen.getByRole('button', {
      name: 'Abrir o console de atividade dos servidores MCP'
    })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.hasAttribute('data-troubled')).toBe(true)
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalled()
  })
})
