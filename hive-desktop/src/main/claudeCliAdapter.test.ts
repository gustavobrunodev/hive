import { describe, expect, it, vi } from 'vitest'
import { createFakeProcessRunner, type ProcessHandle, type ProcessRunner } from './processRunner'
import { claudeShellBinding, createClaudeCliAdapter } from './claudeCliAdapter'
import { readMcpRoster } from './cliAdapterCore'
import type { AgentAdapter, AgentEvent, ShellContext, TurnUsage } from './agentAdapter'
import type { ShellInfo } from './shellCatalog'

/** Pulls exactly `count` events off a session's `events` async-iterable. */
async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) {
    const { value } = await iterator.next()
    out.push(value)
  }
  return out
}

/**
 * Wraps a `FakeProcessRunner`'s `run()` so every returned `ProcessHandle`'s
 * `kill()` is observable via a spy, without changing fake-runner behavior
 * otherwise. Used to prove `stop()` reaches the real process handle.
 */
function withKillSpy(runner: ProcessRunner): {
  runner: ProcessRunner
  killSpy: ReturnType<typeof vi.fn>
} {
  const killSpy = vi.fn()
  const wrapped: ProcessRunner = {
    run(command, args, opts) {
      const handle = runner.run(command, args, opts)
      const spiedHandle: ProcessHandle = {
        output: handle.output,
        exitCode: handle.exitCode,
        kill(signal) {
          killSpy(signal)
          handle.kill(signal)
        }
      }
      return spiedHandle
    }
  }
  return { runner: wrapped, killSpy }
}

describe('ClaudeCliAdapter — contract', () => {
  it('structurally satisfies AgentAdapter: id, displayName, capabilities(), startSession() all present and well-typed', () => {
    const adapter: AgentAdapter = createClaudeCliAdapter(createFakeProcessRunner())

    expect(adapter.id).toBe('claude-cli')
    expect(adapter.displayName).toBe('Claude CLI')
    expect(typeof adapter.capabilities).toBe('function')
    expect(typeof adapter.startSession).toBe('function')

    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })
    expect(typeof session.send).toBe('function')
    expect(typeof session.runWorkflow).toBe('function')
    expect(typeof session.stop).toBe('function')
    expect(typeof session.events[Symbol.asyncIterator]).toBe('function')
  })

  it('capabilities() returns non-empty, well-formed, curated model/effort lists and supportsAttachments: true', () => {
    const adapter = createClaudeCliAdapter(createFakeProcessRunner())
    const caps = adapter.capabilities()

    expect(caps.models.length).toBeGreaterThan(0)
    expect(caps.efforts.length).toBeGreaterThan(0)
    // model-picker: exactly one row per list carries the empty id — the "let
    // the CLI decide" option, whose id IS the absence of the flag. Every other
    // row must name a real value the CLI accepts.
    expect(caps.models.filter((model) => model.id === '')).toHaveLength(1)
    expect(caps.efforts.filter((effort) => effort.id === '')).toHaveLength(1)
    for (const model of caps.models) {
      expect(typeof model.id).toBe('string')
      expect(typeof model.label).toBe('string')
      expect(model.label.length).toBeGreaterThan(0)
    }
    for (const effort of caps.efforts) {
      expect(typeof effort.id).toBe('string')
      expect(typeof effort.label).toBe('string')
      expect(effort.label.length).toBeGreaterThan(0)
    }
    // chat-attachments (R6.5/T16): file paths fold into the turn prompt.
    expect(caps.supportsAttachments).toBe(true)
  })

  // session-usage: the UI needs a denominator to turn the `usage` event's raw
  // token counts into "how full is this conversation". The CLI only states its
  // own ceiling once a turn has finished, so every model declares one for the
  // meantime.
  it('every curated model declares its context window', () => {
    const caps = createClaudeCliAdapter(createFakeProcessRunner()).capabilities()

    for (const model of caps.models) {
      // The `[1m]` aliases exist precisely because their window is different —
      // asserting one number for every row would have made them unrepresentable.
      expect(model.contextWindow).toBe(model.id.includes('[1m]') ? 1_000_000 : 200_000)
    }
  })
})

/** The flags every turn carries after the session-history stream-json switch. */
const BASE_FLAGS = [
  '--model',
  'claude-sonnet-4-5',
  '--effort',
  'medium',
  '--permission-mode',
  'acceptEdits',
  '--output-format',
  'stream-json',
  '--include-partial-messages',
  '--verbose'
]

/** Builds one stream-json stdout line (newline-terminated, as the CLI emits). */
function jsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

function textDelta(text: string, sessionId = 'cli-sess-1'): string {
  return jsonLine({
    type: 'stream_event',
    session_id: sessionId,
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } }
  })
}

function initLine(sessionId = 'cli-sess-1'): string {
  return jsonLine({ type: 'system', subtype: 'init', session_id: sessionId })
}

/** An `assistant` message carrying a `tool_use` block (agent-activity + ACR-C7 attribution). */
function toolUseLine(
  name: string,
  filePath: string,
  id = 'tu-1',
  sessionId = 'cli-sess-1'
): string {
  return jsonLine({
    type: 'assistant',
    session_id: sessionId,
    message: { content: [{ type: 'tool_use', id, name, input: { file_path: filePath } }] }
  })
}

describe('ClaudeCliAdapter — session turns (stream-json)', () => {
  it('a successful turn: init → session event, text deltas → tokens, then done', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: textDelta('Hello') },
        { stream: 'stdout', data: textDelta(', world') }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'hi there' })
    const events = await take(session.events, 4)

    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1' },
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ', world' },
      { type: 'done' }
    ])

    // Sanity check on the invocation: cwd is the workspace; model/effort/
    // permission-mode/stream-json flags are forwarded (verified against a
    // real `claude` binary — see claudeCliAdapter.ts header). No --resume
    // for a fresh conversation.
    expect(fakeRunner.calls).toHaveLength(1)
    expect(fakeRunner.calls[0].command).toBe('claude')
    expect(fakeRunner.calls[0].args).toEqual(['-p', 'hi there', ...BASE_FLAGS])
    // agent-terminal: `shell: true` marks this as an agent turn — the one
    // spawn routed through the user's chosen terminal. With no adapter env and
    // nothing chosen, the runner still spawns exactly as it did before.
    // `processGroup: true` rides along with it: under a shell the CLI is a
    // grandchild, so only a group kill can actually stop a turn.
    expect(fakeRunner.calls[0].opts).toEqual({
      cwd: '/ws',
      env: undefined,
      shell: true,
      processGroup: true
    })
  })

  it('emits a tool start per tool_use block — every tool, with filePath only for file-editing ones (agent-activity + ACR-C7)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: textDelta('Editing…') },
        { stream: 'stdout', data: toolUseLine('Write', '/ws/src/a.txt', 'tu-1') },
        // A non-file tool still surfaces as activity — it just carries no
        // `filePath`, so change attribution never mistakes a command for a path.
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            message: {
              content: [
                { type: 'tool_use', id: 'tu-2', name: 'Bash', input: { command: 'npm test' } }
              ]
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'm', effort: 'medium' })

    session.send({ text: 'edit the files' })
    const events = await take(session.events, 5)

    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1', turnId: undefined },
      { type: 'token', text: 'Editing…', turnId: undefined },
      {
        type: 'tool',
        name: 'Write',
        detail: '/ws/src/a.txt',
        toolId: 'tu-1',
        phase: 'start',
        filePath: '/ws/src/a.txt',
        // agent-tool-details: the call travels with the event, so the
        // transcript can show what was invoked and not just that something was.
        params: [{ key: 'file_path', value: '/ws/src/a.txt' }],
        turnId: undefined
      },
      {
        type: 'tool',
        name: 'Bash',
        detail: 'npm test',
        toolId: 'tu-2',
        phase: 'start',
        filePath: undefined,
        params: [{ key: 'command', value: 'npm test' }],
        turnId: undefined
      },
      { type: 'done', turnId: undefined }
    ])
  })

  it('pairs each tool_result back to its tool_use as a tool end, carrying the error flag (agent-activity)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: toolUseLine('Read', '/ws/src/a.txt', 'tu-1') },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'user',
            session_id: 'cli-sess-1',
            message: {
              content: [{ type: 'tool_result', tool_use_id: 'tu-1', is_error: true }]
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'read it' })
    const events = await take(session.events, 4)

    expect(events[2]).toEqual({
      type: 'tool',
      name: '',
      toolId: 'tu-1',
      phase: 'end',
      ok: false,
      // Nothing came back to read — distinct from a tool that answered with
      // an empty string, which travels as a `ToolOutput` with empty text.
      output: undefined,
      turnId: undefined
    })
  })

  it('carries the result text back with the tool end (agent-tool-details)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: toolUseLine('Read', '/ws/src/a.txt', 'tu-1') },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'user',
            session_id: 'cli-sess-1',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'tu-1',
                  content: [{ type: 'text', text: 'linha 1\nlinha 2' }]
                }
              ]
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'read it' })
    const events = await take(session.events, 4)

    expect(events[2]).toMatchObject({
      phase: 'end',
      ok: true,
      output: { text: 'linha 1\nlinha 2', lines: 2 }
    })
  })

  it('wires the permission-prompt tool when an approval bridge is listening, and omits it otherwise (agent-approvals)', () => {
    const withBridge = createFakeProcessRunner()
    createClaudeCliAdapter(withBridge, {
      permissionPrompt: {
        promptToolName: 'mcp__hive_approvals__approve',
        mcpConfig: (turnId) => `{"turn":"${turnId ?? ''}"}`
      }
    })
      .startSession({ workspace: '/ws' })
      .send({ text: 'hi', turnId: 'turn-7' })

    const args = withBridge.calls[0].args
    expect(args).toContain('--permission-prompt-tool')
    expect(args[args.indexOf('--permission-prompt-tool') + 1]).toBe('mcp__hive_approvals__approve')
    // The turn rides along in the config, so an approval routes back to the
    // conversation that raised it.
    expect(args[args.indexOf('--mcp-config') + 1]).toBe('{"turn":"turn-7"}')

    const withoutBridge = createFakeProcessRunner()
    createClaudeCliAdapter(withoutBridge).startSession({ workspace: '/ws' }).send({ text: 'hi' })
    expect(withoutBridge.calls[0].args).not.toContain('--permission-prompt-tool')
    expect(withoutBridge.calls[0].args).not.toContain('--mcp-config')
  })

  it('send({resume}) appends --resume <id> so the turn continues the CLI conversation', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'continue please', resume: 'cli-sess-9' })
    await take(session.events, 1) // drain done

    expect(fakeRunner.calls[0].args).toEqual([
      '-p',
      'continue please',
      ...BASE_FLAGS,
      '--resume',
      'cli-sess-9'
    ])
  })

  it('send({attachments}) folds the file paths into the prompt as an <attached-files> block (chat-attachments)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'resuma isso', attachments: ['/abs/relatorio.pdf', 'docs/prd.md'] })
    await take(session.events, 1) // drain done

    const prompt = fakeRunner.calls[0].args[1]
    expect(prompt.startsWith('resuma isso\n\n<attached-files>')).toBe(true)
    expect(prompt).toContain('- /abs/relatorio.pdf')
    expect(prompt).toContain('- docs/prd.md')
    expect(prompt.trimEnd().endsWith('</attached-files>')).toBe(true)
  })

  it('send with attachments and empty text sends only the <attached-files> block', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: '', attachments: ['/abs/planilha.xlsx'] })
    await take(session.events, 1)

    const prompt = fakeRunner.calls[0].args[1]
    expect(prompt.startsWith('<attached-files>')).toBe(true)
    expect(prompt).toContain('- /abs/planilha.xlsx')
  })

  it('send without attachments leaves the prompt untouched', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'oi', attachments: [] })
    await take(session.events, 1)

    expect(fakeRunner.calls[0].args[1]).toBe('oi')
  })

  it('a JSON line split across chunks reassembles; complete assistant/result objects are not re-emitted as tokens', async () => {
    const fakeRunner = createFakeProcessRunner()
    const delta = textDelta('inteiro')
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: delta.slice(0, 25) },
        { stream: 'stdout', data: delta.slice(25) },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            message: { content: [{ type: 'text', text: 'inteiro' }] }
          })
        },
        {
          stream: 'stdout',
          data: jsonLine({ type: 'result', subtype: 'success', session_id: 'cli-sess-1' })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'q' })
    const events = await take(session.events, 3)

    // One session announcement (deduped across lines), ONE token — the
    // assistant/result echoes never duplicate the streamed text.
    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1' },
      { type: 'token', text: 'inteiro' },
      { type: 'done' }
    ])
  })

  // session-usage: token accounting is reported twice on purpose — a live
  // snapshot per assistant message (so a long turn can show the context window
  // filling up while it runs) and one `final` report off the CLI's own
  // `result` line, which is the only place the turn's cost and duration exist.
  it('emits a usage snapshot per assistant message and a final one from the result line', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            message: {
              model: 'claude-opus-5',
              content: [{ type: 'text', text: 'oi' }],
              usage: {
                input_tokens: 6,
                cache_creation_input_tokens: 14_304,
                cache_read_input_tokens: 61_200,
                output_tokens: 42
              }
            }
          })
        },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'result',
            subtype: 'success',
            session_id: 'cli-sess-1',
            duration_ms: 8858,
            duration_api_ms: 9033,
            total_cost_usd: 0.098,
            usage: {
              input_tokens: 6,
              cache_creation_input_tokens: 14_304,
              cache_read_input_tokens: 61_200,
              output_tokens: 246
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'opus' })

    session.send({ text: 'q', turnId: 'turn-9' })
    const events = await take(session.events, 4)

    expect(events[1]).toEqual({
      type: 'usage',
      turnId: 'turn-9',
      usage: {
        inputTokens: 6,
        cacheCreationTokens: 14_304,
        cacheReadTokens: 61_200,
        outputTokens: 42,
        model: 'claude-opus-5'
      }
    })
    expect(events[2]).toEqual({
      type: 'usage',
      final: true,
      turnId: 'turn-9',
      usage: {
        // Occupancy carried over from the snapshot above, not re-read off the
        // `result` line, whose input counts are a sum over the turn's requests.
        inputTokens: 6,
        cacheCreationTokens: 14_304,
        cacheReadTokens: 61_200,
        // Only the output side is the turn's total.
        outputTokens: 246,
        // The `result` line doesn't name the model; the snapshot did.
        model: 'claude-opus-5',
        contextWindow: undefined,
        costUsd: 0.098,
        durationMs: 8858,
        apiDurationMs: 9033
      }
    })
    expect(events[3]).toEqual({ type: 'done', turnId: 'turn-9' })
  })

  /**
   * The defect: one BMAD prompt reported a 100%-full context window. Captured
   * from a real `claude` 2.1.226 run (`--output-format stream-json`, 5 tool
   * calls in one `-p` turn) — the `result` line's prompt tokens are the SUM
   * over every request the turn made (15 854+22 667+23 298+23 609+23 760 =
   * 109 188), while the window really held the last request's 23 910.
   */
  it('reads the context off the last request, not off the result line’s sums', async () => {
    const requests = [
      { cache_read_input_tokens: 15_854, cache_creation_input_tokens: 6813 },
      { cache_read_input_tokens: 22_667, cache_creation_input_tokens: 631 },
      { cache_read_input_tokens: 23_298, cache_creation_input_tokens: 311 },
      { cache_read_input_tokens: 23_609, cache_creation_input_tokens: 151 },
      { cache_read_input_tokens: 23_760, cache_creation_input_tokens: 142 }
    ]
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        ...requests.map((usage) => ({
          stream: 'stdout' as const,
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            message: {
              model: 'claude-haiku-4-5-20251001',
              content: [{ type: 'text', text: '.' }],
              usage: { input_tokens: 8, output_tokens: 4, ...usage }
            }
          })
        })),
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'result',
            subtype: 'success',
            session_id: 'cli-sess-1',
            total_cost_usd: 0.0330248,
            usage: {
              input_tokens: 42,
              cache_read_input_tokens: 109_188,
              cache_creation_input_tokens: 8048,
              output_tokens: 1060
            },
            modelUsage: {
              'claude-haiku-4-5-20251001': { contextWindow: 200_000 }
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'haiku' })

    session.send({ text: 'q', turnId: 'turn-1' })
    const events = await take(session.events, 7)
    const last = events[6]

    expect(last).toMatchObject({ type: 'usage', final: true })
    const usage = (last as { usage: TurnUsage }).usage
    // 8 + 23 760 + 142 — the last request, i.e. ~12% of the window. Summed it
    // would be 117 278, which is 59% of a window this turn never came near.
    expect(usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens).toBe(23_910)
    // The turn's own totals still come from the result line.
    expect(usage.outputTokens).toBe(1060)
    expect(usage.costUsd).toBeCloseTo(0.0330248)
    // And the CLI's own denominator, rather than a curated constant.
    expect(usage.contextWindow).toBe(200_000)
  })

  /**
   * A `Task`/`Agent` subagent runs its own conversation and reports its own
   * usage. Measured live: the sidechain sat at 11 909–14 632 tokens while the
   * parent was at 23 473, so folding those in made the meter drop mid-turn and
   * then jump back. They carry `parent_tool_use_id`; the parent bills them.
   */
  it('ignores the usage of a subagent’s own conversation', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            parent_tool_use_id: null,
            message: {
              model: 'claude-haiku-4-5-20251001',
              content: [{ type: 'text', text: '.' }],
              usage: {
                input_tokens: 10,
                cache_read_input_tokens: 22_641,
                cache_creation_input_tokens: 822,
                output_tokens: 136
              }
            }
          })
        },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            parent_tool_use_id: 'toolu_sidechain',
            message: {
              model: 'claude-haiku-4-5-20251001',
              content: [{ type: 'text', text: '.' }],
              usage: {
                input_tokens: 10,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 11_899,
                output_tokens: 4
              }
            }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'haiku' })

    session.send({ text: 'q', turnId: 'turn-1' })
    const events = await take(session.events, 3)

    // Session, the parent's snapshot, done — the sidechain's never arrives.
    expect(events.filter((event) => event.type === 'usage')).toHaveLength(1)
    expect(events[2]).toEqual({ type: 'done', turnId: 'turn-1' })
  })

  it('a line with no usage block, or an all-zero one, produces no usage event', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: toolUseLine('Read', '/ws/a.ts') },
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'result',
            subtype: 'success',
            session_id: 'cli-sess-1',
            usage: { input_tokens: 0, output_tokens: 0 }
          })
        }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'opus' })

    session.send({ text: 'q' })
    const events = await take(session.events, 3)

    expect(events.some((event) => event.type === 'usage')).toBe(false)
  })

  it('non-JSON stdout lines fall back to raw tokens (older CLI without stream-json)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [{ stream: 'stdout', data: 'plain old text' }],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'q' })
    const events = await take(session.events, 2)

    expect(events).toEqual([{ type: 'token', text: 'plain old text' }, { type: 'done' }])
  })

  it('a non-zero exit produces an error event carrying the stderr tail (stderr never becomes transcript tokens)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ chunks: [{ stream: 'stderr', data: 'boom' }], code: 1 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'low'
    })

    session.send({ text: 'do a thing' })
    const events = await take(session.events, 1)

    expect(events[0].type).toBe('error')
    const message = (events[0] as { type: 'error'; message: string }).message
    expect(message).toContain('code 1')
    expect(message).toContain('boom')
  })

  it('runWorkflow() spawns a turn (placeholder command) and forwards its resume opt', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: textDelta('working on it') }], code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    expect(() => session.runWorkflow({ key: 'prd' }, { resume: 'cli-sess-3' })).not.toThrow()
    const events = await take(session.events, 3)

    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1' },
      { type: 'token', text: 'working on it' },
      { type: 'done' }
    ])
    // Promptless commands fall back to the skill's slash command.
    expect(fakeRunner.calls[0].args).toContain('/prd')
    expect(fakeRunner.calls[0].args).toContain('--resume')
    expect(fakeRunner.calls[0].args).toContain('cli-sess-3')
  })

  // skill-studio: a per-turn model/effort override replaces the session
  // default for just that turn (send + runWorkflow), leaving the session — and
  // its other, e.g. backgrounded, turns — untouched.
  it('per-turn model/effort override the session default for that turn only', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: textDelta('a') }], code: 0 })
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: textDelta('b') }], code: 0 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.runWorkflow({ key: 'prd' }, { model: 'opus', effort: 'max' })
    await take(session.events, 3)
    const first = fakeRunner.calls[0].args
    expect(first[first.indexOf('--model') + 1]).toBe('opus')
    expect(first[first.indexOf('--effort') + 1]).toBe('max')

    // A turn with no override still uses the session default.
    session.send({ text: 'hi' })
    await take(session.events, 3)
    const second = fakeRunner.calls[1].args
    expect(second[second.indexOf('--model') + 1]).toBe('claude-sonnet-4-5')
    expect(second[second.indexOf('--effort') + 1]).toBe('medium')
  })

  // background-turns: events are tagged with the caller's turnId, and two
  // concurrent turns' streams stay separable.
  it('tags every event with the turn id it was spawned with', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine('cli-sess-1') },
        { stream: 'stdout', data: textDelta('oi') }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'q', turnId: 'turn-7' })
    const events = await take(session.events, 3)

    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1', turnId: 'turn-7' },
      { type: 'token', text: 'oi', turnId: 'turn-7' },
      { type: 'done', turnId: 'turn-7' }
    ])
  })

  it('interrupt(turnId) kills only that turn — a concurrent background turn completes normally', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0, delayMs: 80 }) // turn-a: long-running, will be interrupted
    fakeRunner.script({
      chunks: [{ stream: 'stdout', data: textDelta('bg ok', 'cli-b') }],
      code: 0,
      delayMs: 20
    }) // turn-b: completes
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'primeira', turnId: 'turn-a' })
    session.send({ text: 'segunda', turnId: 'turn-b' })
    session.interrupt('turn-a')

    const events = await take(session.events, 4)
    // turn-a dies as a deliberate interrupt; turn-b streams + finishes.
    expect(events).toContainEqual({ type: 'interrupted', turnId: 'turn-a' })
    expect(events).toContainEqual({ type: 'token', text: 'bg ok', turnId: 'turn-b' })
    expect(events).toContainEqual({ type: 'done', turnId: 'turn-b' })
  })

  it("stop() calls the underlying process handle's kill()", async () => {
    const { runner: spiedRunner, killSpy } = withKillSpy(createFakeProcessRunner())
    // No script queued: the fake runner's default is an immediately-
    // successful empty process, which is fine here — this test only cares
    // that `stop()` reaches `kill()`, not about timing/output.
    const adapter = createClaudeCliAdapter(spiedRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'hi' })
    session.stop()

    expect(killSpy).toHaveBeenCalledTimes(1)
  })

  it('stop() before any turn has started is a safe no-op', () => {
    const adapter = createClaudeCliAdapter(createFakeProcessRunner())
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    expect(() => session.stop()).not.toThrow()
  })

  // chat-controls (CC-R1.5): a user stop() ends the turn with `interrupted`,
  // NOT `error` — a deliberate interrupt is a normal outcome, so the UI keeps
  // partial output and shows no error Alert.
  it('a user stop() mid-turn emits an interrupted event, not error', async () => {
    const fakeRunner = createFakeProcessRunner()
    // delayMs keeps the turn "running" so stop() lands before it settles.
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: 'partial' }], code: 0, delayMs: 50 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'long task' })
    session.stop()

    const events = await take(session.events, 1)
    expect(events).toEqual([{ type: 'interrupted' }])
  })

  // chat-controls, the bug users actually hit on Windows: "clico em interromper
  // e nada acontece". Every test above scripts a process that dies politely, so
  // none of them could have caught it — the real tree there is cmd.exe →
  // claude.cmd → node, the kill reached only cmd.exe, and the surviving CLI
  // held the inherited stdout pipe open, so the turn's exit never resolved and
  // the transcript never closed.
  it('settles the turn the moment the user interrupts, even if the process ignores the signal', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ ignoresKill: true, delayMs: 100_000 })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'long task', turnId: 'turn-x' })
    session.interrupt('turn-x')

    // No timers advanced, no exit awaited: the transcript closes on the click.
    expect(await take(session.events, 1)).toEqual([{ type: 'interrupted', turnId: 'turn-x' }])
  })

  it('escalates to SIGKILL when a turn survives the polite signal', async () => {
    vi.useFakeTimers()
    try {
      const fakeRunner = createFakeProcessRunner()
      fakeRunner.script({ ignoresKill: true, delayMs: 100_000 })
      const adapter = createClaudeCliAdapter(fakeRunner)
      const session = adapter.startSession({
        workspace: '/ws',
        model: 'claude-sonnet-4-5',
        effort: 'medium'
      })

      session.send({ text: 'long task', turnId: 'turn-x' })
      session.interrupt('turn-x')

      expect(fakeRunner.kills[0]).toEqual(['SIGTERM'])
      await vi.advanceTimersByTimeAsync(2000)
      // A CLI that outlives SIGTERM is a CLI still spending the user's tokens.
      expect(fakeRunner.kills[0]).toEqual(['SIGTERM', 'SIGKILL'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('never escalates a turn that honoured the first signal', async () => {
    vi.useFakeTimers()
    try {
      const fakeRunner = createFakeProcessRunner()
      fakeRunner.script({ delayMs: 100_000 })
      const adapter = createClaudeCliAdapter(fakeRunner)
      const session = adapter.startSession({
        workspace: '/ws',
        model: 'claude-sonnet-4-5',
        effort: 'medium'
      })

      session.send({ text: 'long task', turnId: 'turn-x' })
      session.interrupt('turn-x')
      await vi.advanceTimersByTimeAsync(5000)

      expect(fakeRunner.kills[0]).toEqual(['SIGTERM'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops whatever an interrupted turn says on its way out — one terminal event, ever', async () => {
    const fakeRunner = createFakeProcessRunner()
    // Output still in flight when the user stops: it belongs to a transcript
    // the UI has already closed, so appending it would make a turn grow after
    // it finished.
    fakeRunner.script({
      chunks: [{ stream: 'stdout', data: textDelta('tarde demais', 'cli-late') }],
      code: 0,
      delayMs: 20
    })
    fakeRunner.script({
      chunks: [{ stream: 'stdout', data: textDelta('depois', 'cli-2') }],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'primeira', turnId: 'turn-a' })
    session.interrupt('turn-a')
    session.send({ text: 'segunda', turnId: 'turn-b' })

    const events = await take(session.events, 3)
    expect(events).toEqual([
      { type: 'interrupted', turnId: 'turn-a' },
      { type: 'session', id: 'cli-2', turnId: 'turn-b' },
      { type: 'token', text: 'depois', turnId: 'turn-b' }
    ])
  })

  it('after an interrupt, a fresh turn still ends in done (session stays usable)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({ code: 0, delayMs: 50 }) // first turn, interrupted
    fakeRunner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 }) // second turn
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({
      workspace: '/ws',
      model: 'claude-sonnet-4-5',
      effort: 'medium'
    })

    session.send({ text: 'first' })
    session.stop()
    await take(session.events, 1) // drain the interrupted event

    session.send({ text: 'second' })
    const events = await take(session.events, 2)
    expect(events).toEqual([{ type: 'token', text: 'ok' }, { type: 'done' }])
  })
})

/**
 * mcp-visibility: the CLI's `system`/`init` line is the only place the app can
 * learn which MCP servers a turn actually got and whether they answered. It
 * used to be read for its `session_id` alone and thrown away, which is why the
 * app could watch an agent drive Playwright and still show nothing about MCP.
 *
 * `readMcpRoster` is tested directly as well as through the adapter: it is a
 * parse of somebody else's wire format, and the failure mode of getting it
 * wrong is a confident lie on screen rather than a crash.
 */
describe('readMcpRoster (system/init)', () => {
  const init = (over: Record<string, unknown>): Parameters<typeof readMcpRoster>[0] => ({
    type: 'system',
    subtype: 'init',
    ...over
  })

  it('pairs each reported server with the tools it exposes', () => {
    expect(
      readMcpRoster(
        init({
          mcp_servers: [{ name: 'playwright', status: 'connected' }],
          tools: [
            'Bash',
            'mcp__playwright__browser_navigate',
            'mcp__playwright__browser_take_screenshot'
          ]
        })
      )
    ).toEqual([
      {
        name: 'playwright',
        status: 'connected',
        tools: ['browser_navigate', 'browser_take_screenshot']
      }
    ])
  })

  it("matches a dashed server name against the CLI's underscored tool namespace", () => {
    // The CLI's tool namespace admits only [A-Za-z0-9_], so `hive-approvals`
    // becomes `mcp__hive_approvals__*`. Matching on the raw string would split
    // one server into two, each holding half the truth.
    const roster = readMcpRoster(
      init({
        mcp_servers: [{ name: 'hive-approvals', status: 'connected' }],
        tools: ['mcp__hive_approvals__approve']
      })
    )
    expect(roster).toEqual([{ name: 'hive-approvals', status: 'connected', tools: ['approve'] }])
  })

  it('narrows the status word, and never reads an unknown one as fine', () => {
    const roster = readMcpRoster(
      init({
        mcp_servers: [
          { name: 'a', status: 'failed' },
          { name: 'b', status: 'needs-auth' },
          { name: 'c', status: 'pending' },
          { name: 'd', status: 'something-new' },
          { name: 'e' }
        ],
        tools: []
      })
    )
    expect(roster?.map((server) => server.status)).toEqual([
      'failed',
      'needs-auth',
      'pending',
      'unknown',
      'unknown'
    ])
  })

  it('returns null for lines that are not an init, and for a CLI that reports no servers', () => {
    expect(readMcpRoster({ type: 'assistant' })).toBeNull()
    expect(readMcpRoster(init({ tools: ['Bash'] }))).toBeNull()
    // An empty array is a real answer ("this turn got none") and stays a roster.
    expect(readMcpRoster(init({ mcp_servers: [], tools: [] }))).toEqual([])
  })

  it('drops malformed entries rather than inventing a nameless server', () => {
    expect(
      readMcpRoster(
        init({ mcp_servers: [null, 'playwright', { name: '  ' }, { name: 'ok' }], tools: [] })
      )
    ).toEqual([{ name: 'ok', status: 'unknown', tools: [] }])
  })

  it('ignores tool names whose namespace matches no reported server', () => {
    expect(
      readMcpRoster(
        init({
          mcp_servers: [{ name: 'pencil', status: 'connected' }],
          tools: ['mcp__ghost__thing', 'mcp__pencil__execute', 'mcp__malformed', 'mcp____empty']
        })
      )
    ).toEqual([{ name: 'pencil', status: 'connected', tools: ['execute'] }])
  })
})

describe("ClaudeCliAdapter — the turn's MCP roster", () => {
  it('emits one mcp event off the init line, before any tool call', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'system',
            subtype: 'init',
            session_id: 'cli-sess-1',
            mcp_servers: [
              { name: 'playwright', status: 'connected' },
              { name: 'broken', status: 'failed' }
            ],
            tools: ['Read', 'mcp__playwright__browser_navigate']
          })
        },
        { stream: 'stdout', data: textDelta('pronto') }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'm', effort: 'medium' })

    session.send({ text: 'use o playwright' })
    const events = await take(session.events, 4)

    expect(events).toEqual([
      { type: 'session', id: 'cli-sess-1', turnId: undefined },
      {
        type: 'mcp',
        turnId: undefined,
        servers: [
          { name: 'playwright', status: 'connected', tools: ['browser_navigate'] },
          { name: 'broken', status: 'failed', tools: [] }
        ]
      },
      { type: 'token', text: 'pronto', turnId: undefined },
      { type: 'done', turnId: undefined }
    ])
  })

  it('stays silent on a CLI build whose init line carries no mcp_servers', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: textDelta('oi') }
      ],
      code: 0
    })
    const adapter = createClaudeCliAdapter(fakeRunner)
    const session = adapter.startSession({ workspace: '/ws', model: 'm', effort: 'medium' })

    session.send({ text: 'oi' })
    const events = await take(session.events, 3)
    expect(events.some((event) => event.type === 'mcp')).toBe(false)
  })
})

/**
 * agent-terminal (AT-R4/AT-R5). Every expectation below was read out of the
 * shipped `claude` binary (2.1.226), not inferred from documentation: the CLI
 * accepts `CLAUDE_CODE_SHELL` **only** for a bash/zsh path, uses
 * `CLAUDE_CODE_GIT_BASH_PATH` as its Windows executor, and has no cmd executor
 * at all. Guessing any of these produces a setting that silently does nothing,
 * which is worse than not offering it.
 *
 * The Windows cases carry a second, harder rule the first version of this
 * feature missed. With `CLAUDE_CODE_USE_POWERSHELL_TOOL` **unset**, the CLI's
 * own `LY()` ends at `nt("tengu_cobalt_ridge", !1)` — a remote feature gate.
 * So "set nothing and let the CLI decide" is not a neutral choice, it is a
 * coin flip, and it is the one that produced the bug report ("escolhi o Git
 * Bash e o agente diz que usa PowerShell"). Every Windows binding writes the
 * variable explicitly; these tests are what keep it that way.
 */
describe('ClaudeCliAdapter — the chosen terminal', () => {
  const shell = (id: string, family: ShellInfo['family'], path: string): ShellInfo => ({
    id,
    family,
    path,
    systemDefault: false
  })

  const GIT_BASH = shell('git-bash', 'bash', 'C:\\Program Files\\Git\\bin\\bash.exe')
  const POWERSHELL = shell('powershell', 'powershell', 'C:\\powershell.exe')
  const CMD = shell('cmd', 'cmd', 'C:\\Windows\\System32\\cmd.exe')
  const ZSH = shell('zsh', 'zsh', '/usr/bin/zsh')
  const BASH = shell('bash', 'bash', '/bin/bash')

  const windows = (available: ShellInfo[]): ShellContext => ({ available, platform: 'win32' })
  const posix = (available: ShellInfo[]): ShellContext => ({ available, platform: 'darwin' })

  it('exports CLAUDE_CODE_SHELL for bash and zsh — the only two the CLI accepts', () => {
    expect(claudeShellBinding(ZSH, posix([ZSH, BASH]))).toEqual({
      support: 'native',
      runsIn: 'zsh',
      env: { CLAUDE_CODE_SHELL: '/usr/bin/zsh' }
    })
    expect(claudeShellBinding(BASH, posix([ZSH, BASH]))).toEqual({
      support: 'native',
      runsIn: 'bash',
      env: { CLAUDE_CODE_SHELL: '/bin/bash' }
    })
  })

  it('pins fish/sh to a real bash or zsh instead of letting the CLI scan for one', () => {
    const fish = shell('fish', 'fish', '/usr/bin/fish')
    expect(claudeShellBinding(fish, posix([fish, BASH, ZSH]))).toEqual({
      support: 'fallback',
      note: 'posix-bash-zsh-only',
      runsIn: 'zsh',
      env: { CLAUDE_CODE_SHELL: '/usr/bin/zsh' }
    })
  })

  it('leaves fish alone when the machine has no bash or zsh to pin it to', () => {
    const fish = shell('fish', 'fish', '/usr/bin/fish')
    expect(claudeShellBinding(fish, posix([fish]))).toEqual({
      support: 'launch-only',
      note: 'posix-bash-zsh-only',
      runsIn: null,
      env: {}
    })
  })

  it('points the Windows executor at the chosen Git Bash and turns PowerShell off', () => {
    // The `0` is the fix. Without it the CLI keeps its PowerShell tool on
    // (gate `tengu_cobalt_ridge`) and reports "PowerShell (primary)" in its own
    // environment block while running inside this bash.
    expect(claudeShellBinding(GIT_BASH, windows([CMD, POWERSHELL, GIT_BASH]))).toEqual({
      support: 'native',
      note: 'windows-git-bash',
      runsIn: 'git-bash',
      env: {
        CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe',
        CLAUDE_CODE_USE_POWERSHELL_TOOL: '0'
      }
    })
  })

  it('turns on the PowerShell tool, and keeps the preview label the CLI itself uses', () => {
    const pwsh = shell('pwsh', 'powershell', 'C:\\pwsh.exe')
    expect(claudeShellBinding(pwsh, windows([CMD, pwsh]))).toEqual({
      support: 'native',
      note: 'powershell-preview',
      runsIn: 'pwsh',
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }
    })
  })

  it('pins cmd to the Git Bash on the machine, and names it (AT-R5, D-AT-2)', () => {
    // cmd is the Windows *default*, so this is the path most users take. The
    // CLI has no cmd executor; the choice is between naming where the commands
    // land and letting a remote gate decide it silently.
    expect(claudeShellBinding(CMD, windows([CMD, POWERSHELL, GIT_BASH]))).toEqual({
      support: 'fallback',
      note: 'cmd-no-executor',
      runsIn: 'git-bash',
      env: {
        CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe',
        CLAUDE_CODE_USE_POWERSHELL_TOOL: '0'
      }
    })
  })

  it('falls back to PowerShell — never to a bare 0 — when there is no Git Bash', () => {
    // `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` with no Git Bash makes the CLI
    // `process.exit(1)` at startup ("Claude Code on Windows requires a shell
    // tool"), so this case must resolve the other way and say so.
    expect(claudeShellBinding(CMD, windows([CMD, POWERSHELL]))).toEqual({
      support: 'fallback',
      note: 'install-git-bash',
      runsIn: 'powershell',
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }
    })
  })

  it('sends the binding with the turn, re-read per message', () => {
    const runner = createFakeProcessRunner()
    let current: ShellInfo | null = ZSH
    const adapter = createClaudeCliAdapter(runner, {
      shell: () => current,
      shells: () => [ZSH, BASH]
    })
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'oi' })
    expect(runner.calls[0].opts?.env).toEqual({ CLAUDE_CODE_SHELL: '/usr/bin/zsh' })
    expect(runner.calls[0].opts?.shell).toBe(true)

    // The user switches terminals mid-conversation: the very next turn honours
    // it, with no restart and no new session.
    current = BASH
    session.send({ text: 'de novo' })
    expect(runner.calls[1].opts?.env).toEqual({ CLAUDE_CODE_SHELL: '/bin/bash' })
  })

  it('sends no shell env at all when nothing was chosen', () => {
    const runner = createFakeProcessRunner()
    createClaudeCliAdapter(runner).startSession({ workspace: '/ws' }).send({ text: 'oi' })
    expect(runner.calls[0].opts?.env).toBeUndefined()
  })
})
