import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  approvalDetailFor,
  approvalRuleFor,
  createApprovalService,
  type ApprovalService
} from './approvalService'
import type { ApprovalEvent } from './agentAdapter'

/**
 * The MCP endpoint + auth headers a spawned CLI child would be handed.
 *
 * `mcpConfig` answers with a **path**, never inline JSON — the whole point of
 * the fix it guards (a Windows shell splits an argument holding a quote and a
 * space) — so every test reads the config back off disk, exactly like the CLI.
 */
function endpointOf(service: ApprovalService, turnId?: string): { url: string; headers: Headers } {
  const path = service.mcpConfig(turnId) as string
  const config = JSON.parse(readFileSync(path, 'utf-8')) as {
    mcpServers: Record<string, { url: string; headers: Record<string, string> }>
  }
  const server = config.mcpServers.hive_approvals
  return { url: server.url, headers: new Headers(server.headers) }
}

async function rpc(
  service: ApprovalService,
  body: unknown,
  opts: { turnId?: string; headers?: Record<string, string> } = {}
): Promise<Response> {
  const endpoint = endpointOf(service, opts.turnId)
  const headers = new Headers(endpoint.headers)
  headers.set('content-type', 'application/json')
  for (const [key, value] of Object.entries(opts.headers ?? {})) headers.set(key, value)
  return fetch(endpoint.url, { method: 'POST', headers, body: JSON.stringify(body) })
}

/** Resolves with the first request the service raises. */
function nextRequest(service: ApprovalService): Promise<ApprovalEvent> {
  return new Promise((resolve) => {
    const off = service.onRequest((request) => {
      off()
      resolve(request)
    })
  })
}

const CALL = (tool: string, input: Record<string, unknown>, id = 1): unknown => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name: 'approve', arguments: { tool_name: tool, input } }
})

/** The decision the CLI reads back out of the tool result's text content. */
async function verdictOf(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as { result: { content: Array<{ text: string }> } }
  return JSON.parse(body.result.content[0].text) as Record<string, unknown>
}

describe('approvalRuleFor', () => {
  it('remembers a shell command by its executable, not the whole command line', () => {
    // A rule keyed on the full line would never match twice; one keyed on bare
    // `Bash` would hand over the entire shell on a single click.
    expect(approvalRuleFor('Bash', { command: 'npm run verify -- --watch' })).toBe('Bash:npm')
    expect(approvalRuleFor('Bash', { command: '  git   status ' })).toBe('Bash:git')
  })

  it('falls back to the bare tool name when there is nothing to narrow on', () => {
    expect(approvalRuleFor('Bash', { command: '   ' })).toBe('Bash')
    expect(approvalRuleFor('Bash', undefined)).toBe('Bash')
    expect(approvalRuleFor('WebFetch', { url: 'https://example.com' })).toBe('WebFetch')
  })
})

describe('approvalDetailFor', () => {
  it('picks the one field the decision actually turns on', () => {
    expect(approvalDetailFor({ command: 'rm -rf build' })).toBe('rm -rf build')
    expect(approvalDetailFor({ url: 'https://example.com' })).toBe('https://example.com')
    expect(approvalDetailFor({ file_path: '/ws/a.txt', content: 'x' })).toBe('/ws/a.txt')
  })

  it('returns nothing rather than a JSON blob when no field is recognizable', () => {
    expect(approvalDetailFor({ weird: { nested: true } })).toBeUndefined()
    expect(approvalDetailFor(undefined)).toBeUndefined()
  })
})

describe('ApprovalService — the MCP permission-prompt endpoint', () => {
  /** Every service in this file writes its per-turn configs here, not into the shared temp default. */
  const CONFIG_DIR = mkdtempSync(join(tmpdir(), 'hive-approvals-test-'))

  async function withService(
    run: (service: ApprovalService) => Promise<void>,
    options: Parameters<typeof createApprovalService>[0] = {}
  ): Promise<void> {
    const service = createApprovalService({ configDir: CONFIG_DIR, ...options })
    await service.listen()
    try {
      await run(service)
    } finally {
      await service.close()
    }
  }

  it('advertises no config until it is listening, then a loopback endpoint carrying the turn', async () => {
    const service = createApprovalService({ configDir: CONFIG_DIR })
    // Before `listen()` there is no port — adapters must omit the flags rather
    // than point the CLI at nothing.
    expect(service.mcpConfig('t-1')).toBeNull()
    await service.listen()
    try {
      const { url, headers } = endpointOf(service, 't-1')
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/)
      expect(headers.get('X-Hive-Turn')).toBe('t-1')
      expect(headers.get('Authorization')).toMatch(/^Bearer /)
    } finally {
      await service.close()
    }
  })

  it('refuses any caller without the run token, so a local process cannot forge approvals', async () => {
    await withService(async (service) => {
      const endpoint = endpointOf(service)
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      })
      expect(response.status).toBe(401)
    })
  })

  it('speaks enough MCP for the CLI to discover the prompt tool', async () => {
    await withService(async (service) => {
      const init = (await (
        await rpc(service, {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize'
        })
      ).json()) as { result: { capabilities: unknown; serverInfo: { name: string } } }
      expect(init.result.serverInfo.name).toBe('hive_approvals')
      expect(init.result.capabilities).toEqual({ tools: {} })

      const list = (await (
        await rpc(service, {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        })
      ).json()) as { result: { tools: Array<{ name: string }> } }
      expect(list.result.tools.map((tool) => tool.name)).toEqual(['approve'])
      expect(service.promptToolName).toBe('mcp__hive_approvals__approve')

      // A notification (no id) is acknowledged with no body.
      const ack = await rpc(service, { jsonrpc: '2.0', method: 'notifications/initialized' })
      expect(ack.status).toBe(202)
    })
  })

  it('blocks the call until the user answers, then returns the CLI-shaped verdict', async () => {
    await withService(async (service) => {
      const raised = nextRequest(service)
      const pending = rpc(service, CALL('Bash', { command: 'mkdir -p vault' }), { turnId: 't-9' })

      const request = await raised
      expect(request).toMatchObject({
        type: 'approval',
        tool: 'Bash',
        detail: 'mkdir -p vault',
        turnId: 't-9'
      })

      // Nothing has been answered yet — the CLI child is still parked.
      let settled = false
      void pending.then(() => {
        settled = true
      })
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(settled).toBe(false)

      service.respond(request.requestId, { behavior: 'allow', scope: 'once' })
      expect(await verdictOf(await pending)).toEqual({
        behavior: 'allow',
        updatedInput: { command: 'mkdir -p vault' }
      })
    })
  })

  it('returns a denial with the reason so the agent can adapt instead of retrying blind', async () => {
    await withService(async (service) => {
      const raised = nextRequest(service)
      const pending = rpc(service, CALL('Bash', { command: 'rm -rf /' }))
      const request = await raised
      service.respond(request.requestId, { behavior: 'deny', message: 'Não, use o vault.' })

      expect(await verdictOf(await pending)).toEqual({
        behavior: 'deny',
        message: 'Não, use o vault.'
      })
    })
  })

  it('a "sempre" answer is persisted and auto-allows the next matching call without asking again', async () => {
    const saved: string[][] = []
    await withService(
      async (service) => {
        const raised = nextRequest(service)
        const first = rpc(service, CALL('Bash', { command: 'npm test' }))
        service.respond((await raised).requestId, { behavior: 'allow', scope: 'always' })
        await first
        expect(saved.at(-1)).toEqual(['Bash:npm'])

        // A second `npm …` call never reaches the UI at all.
        let asked = false
        const off = service.onRequest(() => {
          asked = true
        })
        const verdict = await verdictOf(
          await rpc(service, CALL('Bash', { command: 'npm run dev' }))
        )
        off()
        expect(asked).toBe(false)
        expect(verdict).toMatchObject({ behavior: 'allow' })

        // A different executable is still its own decision.
        const raisedGit = nextRequest(service)
        const gitCall = rpc(service, CALL('Bash', { command: 'git push' }))
        service.respond((await raisedGit).requestId, { behavior: 'deny' })
        expect(await verdictOf(await gitCall)).toMatchObject({ behavior: 'deny' })
      },
      { onRulesChanged: (rules) => saved.push(rules) }
    )
  })

  it('restores standing rules from disk, and forgets them all on request', async () => {
    const saved: string[][] = []
    await withService(
      async (service) => {
        expect(service.rules()).toEqual(['WebFetch'])
        let asked = false
        const off = service.onRequest(() => {
          asked = true
        })
        expect(
          await verdictOf(await rpc(service, CALL('WebFetch', { url: 'https://x.dev' })))
        ).toMatchObject({ behavior: 'allow' })
        off()
        expect(asked).toBe(false)

        service.clearRules()
        expect(service.rules()).toEqual([])
        expect(saved.at(-1)).toEqual([])
      },
      { rules: ['WebFetch'], onRulesChanged: (rules) => saved.push(rules) }
    )
  })

  it('announces a new standing grant with the call it came from, once', async () => {
    // The hook is how "Sempre permitir" reaches the agent's own permission
    // config (`agentPermissions.ts`) instead of staying a private note inside
    // Hive — so it has to carry enough to write that rule: the tool, its
    // input, and the turn (which agent asked).
    const granted: unknown[] = []
    await withService(
      async (service) => {
        const raised = nextRequest(service)
        const call = rpc(service, CALL('Bash', { command: 'npm test' }), { turnId: 't-1' })
        service.respond((await raised).requestId, { behavior: 'allow', scope: 'always' })
        await call

        expect(granted).toEqual([
          { rule: 'Bash:npm', tool: 'Bash', input: { command: 'npm test' }, turnId: 't-1' }
        ])

        // A call the standing rule already covers never reaches the UI, so it
        // must not re-announce a grant that was already written either.
        await rpc(service, CALL('Bash', { command: 'npm run dev' }))
        expect(granted).toHaveLength(1)
      },
      { onGranted: (grant) => granted.push(grant) }
    )
  })

  it('does not announce a grant for a one-off allow or a denial', async () => {
    const granted: unknown[] = []
    await withService(
      async (service) => {
        const once = nextRequest(service)
        const first = rpc(service, CALL('Read', { file_path: '/a' }, 1))
        service.respond((await once).requestId, { behavior: 'allow', scope: 'once' })
        await first

        const no = nextRequest(service)
        const second = rpc(service, CALL('WebFetch', { url: 'https://x.dev' }, 2))
        service.respond((await no).requestId, { behavior: 'deny', scope: 'always' })
        await second

        expect(granted).toEqual([])
      },
      { onGranted: (grant) => granted.push(grant) }
    )
  })

  // agent-approvals (session grant): "Permitir tudo nesta sessão" — the answer
  // to an agent asking every thirty seconds during one working session. It is
  // the widest grant in the app, so what it must NOT do is as much of the
  // contract as what it does: nothing on disk, nothing in the agent's own
  // config, and gone the moment it is revoked.
  it('"tudo nesta sessão" stops the asking, and releases what was already blocked', async () => {
    await withService(async (service) => {
      // Two calls blocked at once — the ordinary case, since the CLI can ask
      // for several tools in one turn.
      const raised: ApprovalEvent[] = []
      const bothRaised = new Promise<void>((resolve) => {
        const off = service.onRequest((request) => {
          raised.push(request)
          if (raised.length === 2) {
            off()
            resolve()
          }
        })
      })
      const first = rpc(service, CALL('Bash', { command: 'npm test' }, 1))
      const second = rpc(service, CALL('WebFetch', { url: 'https://x.dev' }, 2))
      await bothRaised

      service.respond(raised[0].requestId, { behavior: 'allow', scope: 'session' })

      // The answered card releases its own call *and* everything else the
      // agent had parked — a user who just said "tudo" must not be handed the
      // next card immediately.
      expect(await verdictOf(await first)).toMatchObject({ behavior: 'allow' })
      expect(await verdictOf(await second)).toMatchObject({ behavior: 'allow' })
      expect(service.sessionAllowAll()).toBe(true)

      // From here nothing reaches the UI at all, whatever the tool.
      let asked = false
      const off = service.onRequest(() => {
        asked = true
      })
      expect(
        await verdictOf(await rpc(service, CALL('Bash', { command: 'rm -rf /tmp/x' }, 3)))
      ).toMatchObject({ behavior: 'allow' })
      off()
      expect(asked).toBe(false)
    })
  })

  it('the session grant is written nowhere — no standing rule, no agent config, and revocable', async () => {
    const saved: string[][] = []
    const granted: unknown[] = []
    await withService(
      async (service) => {
        const raised = nextRequest(service)
        const call = rpc(service, CALL('Bash', { command: 'npm test' }))
        service.respond((await raised).requestId, { behavior: 'allow', scope: 'session' })
        await call

        expect(service.rules()).toEqual([])
        expect(saved).toEqual([])
        expect(granted).toEqual([])

        // Revoked: the very next call is a question again.
        service.setSessionAllowAll(false)
        expect(service.sessionAllowAll()).toBe(false)
        const asked = nextRequest(service)
        const again = rpc(service, CALL('Bash', { command: 'npm test' }, 2))
        service.respond((await asked).requestId, { behavior: 'deny' })
        expect(await verdictOf(await again)).toMatchObject({ behavior: 'deny' })
      },
      { onRulesChanged: (rules) => saved.push(rules), onGranted: (grant) => granted.push(grant) }
    )
  })

  it('a denial is never remembered — a mistaken "no" cannot quietly block the agent forever', async () => {
    const saved: string[][] = []
    await withService(
      async (service) => {
        const raised = nextRequest(service)
        const call = rpc(service, CALL('Bash', { command: 'npm test' }))
        service.respond((await raised).requestId, { behavior: 'deny', scope: 'always' })
        await call
        expect(saved).toEqual([])
        expect(service.rules()).toEqual([])
      },
      { onRulesChanged: (rules) => saved.push(rules) }
    )
  })

  it('cancelling a turn releases only that turn’s pending requests, as denials', async () => {
    await withService(async (service) => {
      const raisedA = nextRequest(service)
      const callA = rpc(service, CALL('Bash', { command: 'a' }, 1), { turnId: 't-a' })
      await raisedA
      const raisedB = nextRequest(service)
      const callB = rpc(service, CALL('Bash', { command: 'b' }, 2), { turnId: 't-b' })
      const requestB = await raisedB

      service.cancel('t-a')
      expect(await verdictOf(await callA)).toMatchObject({ behavior: 'deny' })

      // The other turn is untouched and still waiting on its own answer.
      service.respond(requestB.requestId, { behavior: 'allow' })
      expect(await verdictOf(await callB)).toMatchObject({ behavior: 'allow' })
    })
  })

  it('auto-denies a request left unanswered past its ceiling, so a closed window cannot strand the CLI', async () => {
    await withService(
      async (service) => {
        const call = rpc(service, CALL('Bash', { command: 'sleep 1' }))
        expect(await verdictOf(await call)).toMatchObject({ behavior: 'deny' })
      },
      { timeoutMs: 10 }
    )
  })

  it('answers an unknown method cleanly instead of pretending to support it', async () => {
    await withService(async (service) => {
      const body = (await (
        await rpc(service, {
          jsonrpc: '2.0',
          id: 7,
          method: 'resources/list'
        })
      ).json()) as { error: { code: number } }
      expect(body.error.code).toBe(-32601)

      // `ping` is the one liveness call the client may make.
      const ping = (await (
        await rpc(service, { jsonrpc: '2.0', id: 8, method: 'ping' })
      ).json()) as { result: unknown }
      expect(ping.result).toEqual({})
    })
  })

  it('rejects a call for a tool it does not host, rather than answering for it', async () => {
    await withService(async (service) => {
      const body = (await (
        await rpc(service, {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'something_else', arguments: {} }
        })
      ).json()) as { result: { isError: boolean } }
      expect(body.result.isError).toBe(true)
    })
  })

  it('handles a malformed or unsupported request without taking the endpoint down', async () => {
    await withService(async (service) => {
      const endpoint = endpointOf(service)
      const headers = new Headers(endpoint.headers)

      const badJson = await fetch(endpoint.url, { method: 'POST', headers, body: '{oops' })
      expect(badJson.status).toBe(400)

      // The client may probe GET (server-push SSE) / DELETE (session
      // teardown); neither is offered, and neither may 500.
      expect((await fetch(endpoint.url, { method: 'GET', headers })).status).toBe(405)
      expect((await fetch(endpoint.url, { method: 'DELETE', headers })).status).toBe(405)

      // A call with no arguments at all still resolves rather than throwing.
      const raised = nextRequest(service)
      const pending = rpc(service, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'approve' }
      })
      const request = await raised
      expect(request.tool).toBe('unknown')
      service.respond(request.requestId, { behavior: 'allow' })
      expect(await verdictOf(await pending)).toEqual({ behavior: 'allow', updatedInput: {} })
    })
  })

  it('supplies a default refusal message when the UI sends none', async () => {
    await withService(async (service) => {
      const raised = nextRequest(service)
      const pending = rpc(service, CALL('Bash', { command: 'x' }))
      service.respond((await raised).requestId, { behavior: 'deny' })
      expect(await verdictOf(await pending)).toEqual({
        behavior: 'deny',
        message: 'Denied by the user in Hive.'
      })
    })
  })

  it('close() is idempotent and denies whatever was still pending', async () => {
    const service = createApprovalService({ configDir: CONFIG_DIR })
    await service.listen()
    // A second listen() is a no-op rather than a second port.
    await service.listen()
    const raised = nextRequest(service)
    const pending = rpc(service, CALL('Bash', { command: 'x' }))
    await raised

    await service.close()
    expect(await verdictOf(await pending)).toMatchObject({ behavior: 'deny' })
    expect(service.mcpConfig()).toBeNull()
    await service.close()
  })

  it('hands the CLI a file path, never inline JSON — the Windows argv split', async () => {
    await withService(async (service) => {
      const path = service.mcpConfig('turn-4') as string
      // The regression this guards: the config used to travel as an argument.
      // An argument holding both a quote and a space is re-split between the
      // Windows shell and the npm `.cmd` shim, and every session died with
      // "Invalid MCP configuration: MCP config file not found".
      expect(path.startsWith('{')).toBe(false)
      expect(path).toContain(CONFIG_DIR)
      const raw = readFileSync(path, 'utf-8')
      expect(JSON.parse(raw)).toMatchObject({
        mcpServers: { hive_approvals: { type: 'http' } }
      })
      // The one property a path must have that the JSON did not: no space and
      // no quote anywhere in it, so no layer can split it.
      expect(/["\s]/.test(path.replace(CONFIG_DIR, ''))).toBe(false)
      // Two turns never share a file — concurrent turns each carry their own
      // `X-Hive-Turn` header.
      expect(service.mcpConfig('turn-5')).not.toBe(path)
    })
  })

  it('deletes the config files it wrote when it closes', async () => {
    const service = createApprovalService({ configDir: CONFIG_DIR })
    await service.listen()
    const path = service.mcpConfig('turn-9') as string
    expect(existsSync(path)).toBe(true)
    await service.close()
    // The file carries this run's bearer token; leaving it on disk after the
    // listener is gone is a token with no lock left on it.
    expect(existsSync(path)).toBe(false)
  })

  it('ignores a verdict for a request that no longer exists', async () => {
    await withService(async (service) => {
      // A card can outlive its turn; answering it must be a no-op, not a throw.
      expect(() => service.respond('nope', { behavior: 'allow' })).not.toThrow()
    })
  })
})
