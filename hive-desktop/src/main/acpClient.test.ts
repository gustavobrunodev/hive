import { describe, expect, it } from 'vitest'
import { createAcpClient, AcpError } from './acpClient'
import { createAcpTestServer } from './acpTestServer'

describe('AcpClient — JSON-RPC over stdio', () => {
  it('correlates a response with its request and resolves the result', async () => {
    const server = createAcpTestServer((method) =>
      method === 'initialize' ? { protocolVersion: 1 } : {}
    )
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })

    await expect(client.request('initialize', { protocolVersion: 1 })).resolves.toEqual({
      protocolVersion: 1
    })
    expect(server.received[0]).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: 1 }
    })
  })

  it('keeps concurrent requests apart, whatever order they are answered in', async () => {
    // The agent answers the *second* request first. Without id correlation the
    // first caller would take the second's result.
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })

    const first = client.request('session/prompt', { n: 1 })
    const second = client.request('session/prompt', { n: 2 })
    server.emit({ jsonrpc: '2.0', id: 2, result: { which: 'second' } })
    server.emit({ jsonrpc: '2.0', id: 1, result: { which: 'first' } })

    expect(await first).toEqual({ which: 'first' })
    expect(await second).toEqual({ which: 'second' })
  })

  it('rejects with the agent’s own error code and message', async () => {
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })
    const pending = client.request('session/load', {})
    server.emit({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32016, message: 'Session not found' }
    })

    await expect(pending).rejects.toBeInstanceOf(AcpError)
    await expect(pending).rejects.toMatchObject({ code: -32016, message: 'Session not found' })
  })

  it('reassembles a message split across chunks, and ignores non-JSON lines', async () => {
    // Both halves of the framing contract at once: a 10 KB session/update does
    // not arrive whole, and a CLI banner on stdout must not be fatal.
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })
    const updates: unknown[] = []
    client.onNotify('session/update', (params) => updates.push(params))

    server.emitRaw('Devin CLI v3000\n')
    server.emitRaw('{"jsonrpc":"2.0","method":"session/upd')
    server.emitRaw('ate","params":{"update":{"sessionUpdate":"x"}}}\n')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updates).toEqual([{ update: { sessionUpdate: 'x' } }])
  })

  it('answers an inbound request from the registered handler', async () => {
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })
    client.onRequest('fs/read_text_file', () => ({ content: 'olá' }))

    server.emit({ jsonrpc: '2.0', id: 77, method: 'fs/read_text_file', params: { path: '/a' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(server.received).toContainEqual({ jsonrpc: '2.0', id: 77, result: { content: 'olá' } })
  })

  it('answers method-not-found rather than going silent on an unhandled request', async () => {
    // The failure this prevents is not an error — it is a hang. An ACP agent
    // that asks the client for something and gets nothing back waits forever,
    // and the turn parks with it.
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })

    server.emit({ jsonrpc: '2.0', id: 5, method: 'terminal/create', params: {} })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(server.received).toContainEqual(
      expect.objectContaining({ id: 5, error: expect.objectContaining({ code: -32601 }) })
    )
    void client
  })

  it('reports a throwing handler as an error reply, not as a dropped message', async () => {
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })
    client.onRequest('fs/read_text_file', () => {
      throw new Error('ENOENT')
    })

    server.emit({ jsonrpc: '2.0', id: 9, method: 'fs/read_text_file', params: {} })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(server.received).toContainEqual(
      expect.objectContaining({ id: 9, error: expect.objectContaining({ message: 'ENOENT' }) })
    )
  })

  it('sends a notification with no id, and never waits for an answer', async () => {
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })

    client.notify('session/cancel', { sessionId: 's1' })

    expect(server.received[0]).toEqual({
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: { sessionId: 's1' }
    })
    expect(server.received[0]).not.toHaveProperty('id')
  })

  it('rejects everything still in flight when the agent process dies', async () => {
    const server = createAcpTestServer(() => undefined)
    const client = createAcpClient(server, { command: 'devin', args: ['acp'] })
    const pending = client.request('session/prompt', {})

    server.exit(1)

    await expect(pending).rejects.toThrow(/terminou/)
    await client.closed
  })

  it('opens stdin as a pipe — without it there is nothing to speak into', () => {
    const server = createAcpTestServer(() => undefined)
    createAcpClient(server, { command: 'devin', args: ['acp'], cwd: '/ws' })

    expect(server.startOptions?.stdin).toBe('pipe')
    expect(server.startOptions?.cwd).toBe('/ws')
    // The process group is what makes Stop reach the agent's own children.
    expect(server.startOptions?.processGroup).toBe(true)
  })
})
