import { describe, expect, it, vi } from 'vitest'
import { createFakeProcessRunner, type ProcessHandle, type ProcessRunner } from './processRunner'
import { createClaudeCliAdapter } from './claudeCliAdapter'
import type { AgentAdapter, AgentEvent } from './agentAdapter'

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
    for (const model of caps.models) {
      expect(typeof model.id).toBe('string')
      expect(model.id.length).toBeGreaterThan(0)
      expect(typeof model.label).toBe('string')
      expect(model.label.length).toBeGreaterThan(0)
    }
    for (const effort of caps.efforts) {
      expect(typeof effort.id).toBe('string')
      expect(effort.id.length).toBeGreaterThan(0)
      expect(typeof effort.label).toBe('string')
      expect(effort.label.length).toBeGreaterThan(0)
    }
    // chat-attachments (R6.5/T16): file paths fold into the turn prompt.
    expect(caps.supportsAttachments).toBe(true)
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

/** An `assistant` message carrying a `tool_use` block (Agent Change Review attribution, ACR-C7). */
function toolUseLine(name: string, filePath: string, sessionId = 'cli-sess-1'): string {
  return jsonLine({
    type: 'assistant',
    session_id: sessionId,
    message: { content: [{ type: 'tool_use', name, input: { file_path: filePath } }] }
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
    expect(fakeRunner.calls[0].opts).toEqual({ cwd: '/ws' })
  })

  it('emits a tool event per file-editing tool_use block, without disturbing token streaming (ACR-C7)', async () => {
    const fakeRunner = createFakeProcessRunner()
    fakeRunner.script({
      chunks: [
        { stream: 'stdout', data: initLine() },
        { stream: 'stdout', data: textDelta('Editing…') },
        { stream: 'stdout', data: toolUseLine('Write', '/ws/src/a.txt') },
        { stream: 'stdout', data: toolUseLine('MultiEdit', '/ws/src/b.txt') },
        // A non-file tool (Bash) is not attributed.
        {
          stream: 'stdout',
          data: jsonLine({
            type: 'assistant',
            session_id: 'cli-sess-1',
            message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] }
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
      { type: 'session', id: 'cli-sess-1' },
      { type: 'token', text: 'Editing…' },
      { type: 'tool', name: 'Write', detail: '/ws/src/a.txt' },
      { type: 'tool', name: 'MultiEdit', detail: '/ws/src/b.txt' },
      { type: 'done' }
    ])
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
