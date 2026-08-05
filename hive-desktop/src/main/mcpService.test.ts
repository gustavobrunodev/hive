import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createMcpService, type McpProbe, type McpService } from './mcpService'

/**
 * `McpService` unit tests — a real temp workspace on disk (so the `.mcp.json`
 * and `.claude/settings.local.json` contracts are exercised for real, same
 * approach as `configStore.test.ts`) and a fake probe (no child processes).
 */

let workspace: string
let probe: ReturnType<typeof vi.fn>
let service: McpService

function readMcp(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(workspace, '.mcp.json'), 'utf8'))
}

function readSettings(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(workspace, '.claude', 'settings.local.json'), 'utf8'))
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'hive-mcp-test-'))
  probe = vi.fn(async () => ({ ok: true, tools: [], logs: '', durationMs: 5 }))
  service = createMcpService({ probe: probe as unknown as McpProbe })
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('McpService.list', () => {
  it('returns [] when there is no .mcp.json', async () => {
    await expect(service.list(workspace)).resolves.toEqual([])
  })

  it('normalizes stdio and remote entries, defaulting to enabled', async () => {
    writeFileSync(
      join(workspace, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          local: { command: 'npx', args: ['-y', 'pkg'], env: { K: 'v' } },
          remote: { type: 'http', url: 'https://x/mcp', headers: { Authorization: 'Bearer t' } },
          bare: { url: 'https://y' }
        }
      })
    )
    const servers = await service.list(workspace)
    expect(servers).toEqual([
      {
        name: 'local',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'pkg'],
        env: { K: 'v' },
        enabled: true
      },
      {
        name: 'remote',
        transport: 'http',
        url: 'https://x/mcp',
        headers: { Authorization: 'Bearer t' },
        enabled: true
      },
      { name: 'bare', transport: 'http', url: 'https://y', enabled: true }
    ])
  })

  it('reflects the disabled denylist as enabled:false', async () => {
    writeFileSync(
      join(workspace, '.mcp.json'),
      JSON.stringify({ mcpServers: { a: { command: 'x' } } })
    )
    mkdirSync(join(workspace, '.claude'), { recursive: true })
    writeFileSync(
      join(workspace, '.claude', 'settings.local.json'),
      JSON.stringify({ disabledMcpjsonServers: ['a'] })
    )
    const [server] = await service.list(workspace)
    expect(server.enabled).toBe(false)
  })

  it('ignores a malformed .mcp.json (returns [])', async () => {
    writeFileSync(join(workspace, '.mcp.json'), 'not json{')
    await expect(service.list(workspace)).resolves.toEqual([])
  })

  it('skips non-object server entries', async () => {
    writeFileSync(
      join(workspace, '.mcp.json'),
      JSON.stringify({ mcpServers: { good: { command: 'x' }, bad: 'nope' } })
    )
    const servers = await service.list(workspace)
    expect(servers.map((s) => s.name)).toEqual(['good'])
  })
})

describe('McpService.add', () => {
  it('writes a new stdio server to .mcp.json', async () => {
    await service.add(workspace, 'srv', { transport: 'stdio', command: 'npx', args: ['-y'] })
    expect(readMcp()).toEqual({ mcpServers: { srv: { command: 'npx', args: ['-y'] } } })
  })

  it('writes a remote server with its type + url + headers', async () => {
    await service.add(workspace, 'r', {
      transport: 'http',
      url: 'https://x',
      headers: { A: 'b' }
    })
    expect(readMcp()).toEqual({
      mcpServers: { r: { type: 'http', url: 'https://x', headers: { A: 'b' } } }
    })
  })

  it('preserves other servers and unknown top-level keys', async () => {
    writeFileSync(
      join(workspace, '.mcp.json'),
      JSON.stringify({ mcpServers: { old: { command: 'a' } }, $schema: 'x' })
    )
    await service.add(workspace, 'new', { transport: 'stdio', command: 'b' })
    const file = readMcp()
    expect(file.$schema).toBe('x')
    expect(Object.keys(file.mcpServers as object)).toEqual(['old', 'new'])
  })

  it('rejects a blank name', async () => {
    await expect(
      service.add(workspace, '  ', { transport: 'stdio', command: 'x' })
    ).rejects.toThrow(/nome/i)
  })

  it('rejects an stdio server without a command', async () => {
    await expect(service.add(workspace, 'x', { transport: 'stdio', command: '' })).rejects.toThrow(
      /comando/i
    )
  })

  it('rejects a remote server without a url', async () => {
    await expect(service.add(workspace, 'x', { transport: 'http', url: '' })).rejects.toThrow(
      /URL/i
    )
  })

  it('rejects a duplicate name', async () => {
    await service.add(workspace, 'dup', { transport: 'stdio', command: 'x' })
    await expect(
      service.add(workspace, 'dup', { transport: 'stdio', command: 'y' })
    ).rejects.toThrow(/já existe/i)
  })
})

describe('McpService.update', () => {
  it('edits a server in place (same name)', async () => {
    await service.add(workspace, 'srv', { transport: 'stdio', command: 'a' })
    await service.update(workspace, 'srv', 'srv', { transport: 'stdio', command: 'b' })
    expect(readMcp().mcpServers).toEqual({ srv: { command: 'b' } })
  })

  it('renames a server, dropping the old key', async () => {
    await service.add(workspace, 'old', { transport: 'stdio', command: 'a' })
    await service.update(workspace, 'old', 'new', { transport: 'stdio', command: 'a' })
    expect(Object.keys(readMcp().mcpServers as object)).toEqual(['new'])
  })

  it('carries the disabled state across a rename', async () => {
    await service.add(workspace, 'old', { transport: 'stdio', command: 'a' })
    await service.setEnabled(workspace, 'old', false)
    await service.update(workspace, 'old', 'new', { transport: 'stdio', command: 'a' })
    const [server] = await service.list(workspace)
    expect(server.name).toBe('new')
    expect(server.enabled).toBe(false)
  })

  it('rejects a rename that collides with another server', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    await service.add(workspace, 'b', { transport: 'stdio', command: 'y' })
    await expect(
      service.update(workspace, 'a', 'b', { transport: 'stdio', command: 'x' })
    ).rejects.toThrow(/já existe/i)
  })
})

describe('McpService.remove', () => {
  it('drops a server from the catalog', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    await service.remove(workspace, 'a')
    await expect(service.list(workspace)).resolves.toEqual([])
  })

  it('also clears the server from the disabled denylist', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    await service.setEnabled(workspace, 'a', false)
    await service.remove(workspace, 'a')
    expect(readSettings().disabledMcpjsonServers).toEqual([])
  })

  it('is a no-op when the server is not present', async () => {
    await expect(service.remove(workspace, 'ghost')).resolves.toBeUndefined()
  })
})

describe('McpService.setEnabled', () => {
  it('adds to the denylist when disabling and keeps enableAllProjectMcpServers', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    await service.setEnabled(workspace, 'a', false)
    const settings = readSettings()
    expect(settings.enableAllProjectMcpServers).toBe(true)
    expect(settings.disabledMcpjsonServers).toEqual(['a'])
  })

  it('removes from the denylist when re-enabling', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    await service.setEnabled(workspace, 'a', false)
    await service.setEnabled(workspace, 'a', true)
    expect(readSettings().disabledMcpjsonServers).toEqual([])
  })

  it('preserves unrelated settings keys', async () => {
    mkdirSync(join(workspace, '.claude'), { recursive: true })
    writeFileSync(
      join(workspace, '.claude', 'settings.local.json'),
      JSON.stringify({ someOtherKey: 42 })
    )
    await service.setEnabled(workspace, 'a', false)
    expect(readSettings().someOtherKey).toBe(42)
  })
})

describe('McpService.probe', () => {
  it('resolves the config and delegates to the injected probe', async () => {
    await service.add(workspace, 'srv', { transport: 'stdio', command: 'npx' })
    const result = await service.probe(workspace, 'srv')
    expect(result.ok).toBe(true)
    expect(probe).toHaveBeenCalledWith({ transport: 'stdio', command: 'npx' }, { cwd: workspace })
  })

  it('rejects when the server is unknown', async () => {
    await expect(service.probe(workspace, 'ghost')).rejects.toThrow(/não encontrado/i)
  })
})

describe('atomic writes', () => {
  it('leaves no .tmp file behind', async () => {
    await service.add(workspace, 'a', { transport: 'stdio', command: 'x' })
    expect(existsSync(join(workspace, '.mcp.json.tmp'))).toBe(false)
  })
})
