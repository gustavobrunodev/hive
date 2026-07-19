// A minimal MCP stdio server fixture for mcpProbe.test.ts — speaks just enough
// JSON-RPC to complete the probe handshake. Behavior is switched by argv[2]:
//   ok      → initialize + tools/list with two tools (default)
//   notools → initialize + empty tools/list
//   refuse  → initialize ok, tools/list returns a JSON-RPC error
//   crash   → exit(1) immediately without responding
const mode = process.argv[2] ?? 'ok'

if (mode === 'crash') {
  process.stderr.write('boom\n')
  process.exit(1)
}

// A line of diagnostics to stderr so the probe has logs to capture.
process.stderr.write('fake-mcp-server: ready\n')

let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString()
  let nl = buffer.indexOf('\n')
  while (nl !== -1) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    nl = buffer.indexOf('\n')
    if (line === '') continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)
    if (msg.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          serverInfo: { name: 'fake', version: '9.9.9' }
        }
      })
    } else if (msg.method === 'tools/list') {
      if (mode === 'refuse') {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'nope' } })
      } else if (mode === 'notools') {
        send({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } })
      } else {
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            tools: [
              { name: 'search', description: 'Search the web' },
              { name: 'open', description: '' }
            ]
          }
        })
      }
    }
  }
})
