// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { McpManager } from './McpManager'
import type { McpProbeResult, McpServer } from './mcpForm'

/**
 * mcp — the "Servidores MCP" module. The DS is mocked with trivial stand-ins
 * (the SkillStudio.test convention). These tests prove the module's contracts:
 * the list renders each server's status/transport, the switch toggles enabled
 * state through `setEnabled`, expanding a row runs a connection probe that
 * surfaces tools + logs, the empty state offers presets that open a prefilled
 * add form, submitting the form calls `add`, and delete removes after confirm.
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
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Spinner: ({ label }: { label?: string }) => createElement('span', null, label ?? 'spinner'),
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
    const rest = { ...props }
    delete rest.minRows
    delete rest.maxRows
    return createElement('textarea', rest)
  },
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    ['aria-label']?: string
  }) =>
    createElement('input', {
      type: 'checkbox',
      role: 'switch',
      checked,
      onChange: () => onCheckedChange?.(!checked),
      'aria-label': rest['aria-label']
    }),
  Tooltip: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipProvider: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children)
}))

type McpApi = {
  list: ReturnType<typeof vi.fn>
  add: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  setEnabled: ReturnType<typeof vi.fn>
  probe: ReturnType<typeof vi.fn>
}

let api: McpApi

function stdioServer(over: Partial<McpServer> = {}): McpServer {
  return {
    name: 'playwright',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    enabled: true,
    ...over
  }
}

function probeOk(over: Partial<McpProbeResult> = {}): McpProbeResult {
  return {
    ok: true,
    tools: [{ name: 'browser_navigate', description: 'Open a URL' }],
    serverName: 'playwright',
    serverVersion: '1.0',
    logs: 'server: ready',
    durationMs: 42,
    ...over
  }
}

beforeEach(() => {
  api = {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    probe: vi.fn().mockResolvedValue(probeOk())
  }
  ;(window as unknown as { hive: { mcp: McpApi } }).hive = { mcp: api }
})

afterEach(() => cleanup())

function renderManager(): void {
  render(createElement(McpManager, { open: true, onOpenChange: vi.fn(), workspace: '/ws' }))
}

describe('McpManager — closed gate', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      createElement(McpManager, { open: false, onOpenChange: vi.fn(), workspace: '/ws' })
    )
    expect(container.firstChild).toBeNull()
    expect(api.list).not.toHaveBeenCalled()
  })
})

describe('McpManager — empty state', () => {
  it('teaches with presets and opens a prefilled add form on a preset click', async () => {
    renderManager()
    expect(await screen.findByText('Nenhum servidor MCP ainda')).toBeTruthy()
    fireEvent.click(screen.getByText('Playwright'))
    // The add form opens with the preset's name prefilled.
    const nameInput = (await screen.findByDisplayValue('playwright')) as HTMLInputElement
    expect(nameInput).toBeTruthy()
  })

  it('opens a blank add form from "Configurar do zero"', async () => {
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    expect(await screen.findByText('Adicionar servidor MCP')).toBeTruthy()
  })
})

describe('McpManager — list + toggle', () => {
  it('renders a server row with its connection summary', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    expect(await screen.findByText('playwright')).toBeTruthy()
    expect(screen.getByText('npx -y @playwright/mcp')).toBeTruthy()
  })

  it('toggles enabled through setEnabled', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    const toggle = (await screen.findByRole('switch', {
      name: /ativar ou desativar playwright/i
    })) as HTMLInputElement
    fireEvent.click(toggle)
    await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith('/ws', 'playwright', false))
  })
})

describe('McpManager — connection probe', () => {
  it('tests the connection and shows tools + logs', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByRole('button', { name: /testar a conexão de playwright/i }))
    await waitFor(() => expect(api.probe).toHaveBeenCalledWith('/ws', 'playwright'))
    expect(await screen.findByText('browser_navigate')).toBeTruthy()
    expect(screen.getByText('server: ready')).toBeTruthy()
  })

  it('surfaces a failed probe reason', async () => {
    api.list.mockResolvedValue([stdioServer()])
    api.probe.mockResolvedValue({
      ok: false,
      tools: [],
      logs: '',
      error: 'Comando não encontrado.',
      durationMs: 3
    })
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByRole('button', { name: /testar a conexão/i }))
    expect(await screen.findByText('Comando não encontrado.')).toBeTruthy()
  })
})

describe('McpManager — add form', () => {
  it('submits a new stdio server via add', async () => {
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    const nameInput = (await screen.findByPlaceholderText('ex.: playwright')) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'myserver' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: npx'), { target: { value: 'npx' } })
    fireEvent.click(screen.getByText('Adicionar', { selector: 'button' }))
    await waitFor(() =>
      expect(api.add).toHaveBeenCalledWith('/ws', 'myserver', {
        transport: 'stdio',
        command: 'npx'
      })
    )
  })

  it('shows a validation error from add without leaving the form', async () => {
    api.add.mockRejectedValue(new Error('Já existe um servidor chamado "dup".'))
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    fireEvent.change(screen.getByPlaceholderText('ex.: playwright'), { target: { value: 'dup' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: npx'), { target: { value: 'npx' } })
    fireEvent.click(screen.getByText('Adicionar', { selector: 'button' }))
    expect(await screen.findByText(/Já existe um servidor/)).toBeTruthy()
  })

  it('switches to the remote transport fields', async () => {
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    fireEvent.click(screen.getByText('Remoto (HTTP)'))
    expect(await screen.findByPlaceholderText('https://exemplo.com/mcp')).toBeTruthy()
  })
})

describe('McpManager — edit + delete', () => {
  it('opens the edit form prefilled from a row', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByText('Editar'))
    expect(await screen.findByText('Editar servidor MCP')).toBeTruthy()
    expect((screen.getByPlaceholderText('ex.: playwright') as HTMLInputElement).value).toBe(
      'playwright'
    )
  })

  it('removes a server after confirmation', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByText('Remover'))
    // Confirm dialog.
    const confirm = await screen.findByText('Remover servidor')
    fireEvent.click(confirm)
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('/ws', 'playwright'))
  })

  it('cancels a delete without calling remove', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByText('Remover'))
    fireEvent.click(await screen.findByText('Cancelar'))
    await waitFor(() => expect(screen.queryByText('Remover servidor')).toBeNull())
    expect(api.remove).not.toHaveBeenCalled()
  })
})

describe('McpManager — header, remote, resilience', () => {
  it('adds from the header button when servers already exist', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByText('Adicionar servidor'))
    expect(await screen.findByText('Adicionar servidor MCP')).toBeTruthy()
  })

  it('renders a remote server and shows its url + headers in the expanded config', async () => {
    api.list.mockResolvedValue([
      {
        name: 'context7',
        transport: 'http',
        url: 'https://mcp.context7.com/mcp',
        headers: { Authorization: 'Bearer x' },
        enabled: true
      }
    ])
    renderManager()
    expect(await screen.findByText('context7')).toBeTruthy()
    expect(screen.getAllByText('https://mcp.context7.com/mcp').length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de context7/i }))
    // The config summary lists the URL term and the header names.
    expect(await screen.findByText('Cabeçalhos')).toBeTruthy()
    expect(screen.getByText('Authorization')).toBeTruthy()
  })

  it('edits an existing server through update', async () => {
    api.list.mockResolvedValue([stdioServer(), stdioServer({ name: 'other', command: 'uvx' })])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByText('Editar'))
    fireEvent.change(screen.getByPlaceholderText('ex.: npx'), { target: { value: 'pnpm' } })
    fireEvent.click(screen.getByText('Salvar alterações', { selector: 'button' }))
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        '/ws',
        'playwright',
        'playwright',
        expect.objectContaining({ transport: 'stdio', command: 'pnpm' })
      )
    )
  })

  it('reloads truth when setEnabled rejects', async () => {
    api.list.mockResolvedValue([stdioServer()])
    api.setEnabled.mockRejectedValue(new Error('disk full'))
    renderManager()
    const toggle = await screen.findByRole('switch', { name: /ativar ou desativar playwright/i })
    fireEvent.click(toggle)
    // The optimistic toggle fails → the module re-reads the server list.
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })

  it('surfaces a thrown probe error as a failed test', async () => {
    api.list.mockResolvedValue([stdioServer()])
    api.probe.mockRejectedValue(new Error('spawn blew up'))
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByRole('button', { name: /testar a conexão/i }))
    expect(await screen.findByText('spawn blew up')).toBeTruthy()
  })

  it('collapses an expanded row on a second toggle', async () => {
    api.list.mockResolvedValue([stdioServer()])
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    // Now collapse via the (relabelled) toggle.
    fireEvent.click(await screen.findByRole('button', { name: /ocultar detalhes de playwright/i }))
    await waitFor(() => expect(screen.queryByText('Testar conexão')).toBeNull())
  })

  it('returns to the list from the add form via Voltar', async () => {
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    fireEvent.click(await screen.findByText('Voltar'))
    expect(await screen.findByText('Nenhum servidor MCP ainda')).toBeTruthy()
  })

  it('prefills the add form from a preset chosen inside the form', async () => {
    renderManager()
    fireEvent.click(await screen.findByText('Configurar do zero'))
    fireEvent.click(await screen.findByText('Fetch'))
    expect((screen.getByPlaceholderText('ex.: playwright') as HTMLInputElement).value).toBe('fetch')
  })

  it('shows a delete error and keeps the confirm open when remove rejects', async () => {
    api.list.mockResolvedValue([stdioServer()])
    api.remove.mockRejectedValue(new Error('locked'))
    renderManager()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalhes de playwright/i }))
    fireEvent.click(await screen.findByText('Remover'))
    fireEvent.click(await screen.findByText('Remover servidor'))
    expect(await screen.findByText(/Não foi possível remover/)).toBeTruthy()
  })
})
