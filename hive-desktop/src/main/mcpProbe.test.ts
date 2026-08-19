import { describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mcpProbe, stdioSpawnPlan } from './mcpProbe'
import type { McpServerConfig } from './mcpService'

/**
 * `mcpProbe` integration tests — the real probe against a real child process
 * (a node fixture that speaks the MCP handshake), so the stdio JSON-RPC path
 * is exercised end-to-end. Fast + deterministic (local node, no network).
 */

const fixture = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'fakeMcpServer.mjs')
const cwd = process.cwd()

function stdio(mode: string): McpServerConfig {
  return { transport: 'stdio', command: process.execPath, args: [fixture, mode] }
}

describe('mcpProbe — stdio handshake', () => {
  it('connects, lists tools, and reports server info + logs', async () => {
    const result = await mcpProbe(stdio('ok'), { cwd })
    expect(result.ok).toBe(true)
    expect(result.tools).toEqual([
      { name: 'search', description: 'Search the web' },
      { name: 'open', description: '' }
    ])
    expect(result.serverName).toBe('fake')
    expect(result.serverVersion).toBe('9.9.9')
    expect(result.logs).toContain('ready')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('connects with an empty tool list', async () => {
    const result = await mcpProbe(stdio('notools'), { cwd })
    expect(result.ok).toBe(true)
    expect(result.tools).toEqual([])
  })

  it('reports a tools/list error as a failed probe', async () => {
    const result = await mcpProbe(stdio('refuse'), { cwd })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('nope')
    expect(result.serverName).toBe('fake')
  })

  it('reports a server that exits before the handshake', async () => {
    const result = await mcpProbe(stdio('crash'), { cwd })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/encerrou/i)
  })

  it('reports a command that does not exist (ENOENT)', async () => {
    const result = await mcpProbe(
      { transport: 'stdio', command: 'definitely-not-a-real-binary-xyz', args: [] },
      { cwd }
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/não encontrado/i)
  })
})

/**
 * The lookup half of the stdio probe. This is the bug the MCP module actually
 * shipped: the canonical server is `npx -y @playwright/mcp@latest`, the probe
 * spawned `npx` against the app's own `PATH` (which, launched from a launcher
 * rather than a terminal, holds no npm/nvm prefix — and on Windows cannot
 * execute an `npx.cmd` shim at all), and the failure surfaced as "Comando não
 * encontrado" on machines where the same line runs in any terminal.
 */
describe('stdioSpawnPlan', () => {
  it('resolves a bare command against the widened PATH, not the app PATH', () => {
    const bin = mkdtempSync(join(tmpdir(), 'hive-mcp-bin-'))
    const executable = join(bin, 'hive-fake-npx')
    writeFileSync(executable, '#!/bin/sh\nexit 0\n')
    chmodSync(executable, 0o755)

    const plan = stdioSpawnPlan(
      { transport: 'stdio', command: 'hive-fake-npx', args: ['-y', 'pkg'] },
      { PATH: bin }
    )

    expect(plan.command).toBe(executable)
    expect(plan.args).toEqual(['-y', 'pkg'])
  })

  it('keeps an unresolvable command verbatim, so the failure stays ENOENT', () => {
    const plan = stdioSpawnPlan(
      { transport: 'stdio', command: 'definitely-not-a-real-binary-xyz' },
      { PATH: '/nonexistent-hive-dir' }
    )
    expect(plan.command).toBe('definitely-not-a-real-binary-xyz')
  })

  it("layers the server's own env over the widened base", () => {
    const plan = stdioSpawnPlan(
      { transport: 'stdio', command: 'x', env: { TOKEN: 'abc', PATH: '/only-here' } },
      { PATH: '/base', HOME: '/home/u' }
    )
    expect(plan.env.TOKEN).toBe('abc')
    expect(plan.env.HOME).toBe('/home/u')
    // The user's own PATH for this server wins over the widened one.
    expect(plan.env.PATH).toBe('/only-here')
  })
})

describe('mcpProbe — remote handshake', () => {
  it('reports a connection failure for an unreachable endpoint', async () => {
    const result = await mcpProbe({ transport: 'http', url: 'http://127.0.0.1:1/mcp' }, { cwd })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
