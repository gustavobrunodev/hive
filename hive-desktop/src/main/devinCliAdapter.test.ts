import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFakeProcessRunner } from './processRunner'
import { createDevinCliAdapter, devinModelArg, readExportedSessionId } from './devinCliAdapter'
import type { AgentEvent } from './agentAdapter'

async function take(events: AsyncIterable<AgentEvent>, count: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  const iterator = events[Symbol.asyncIterator]()
  for (let i = 0; i < count; i++) out.push((await iterator.next()).value)
  return out
}

/** A scratch directory per test, so the export files never collide across runs. */
function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'hive-devin-test-'))
}

describe('DevinCliAdapter', () => {
  // The bug this replaced: the adapter declared `models: []` on the premise
  // that Devin is a fixed-model agent, so the composer hid the picker and the
  // user could not choose. Devin fronts four vendors and documents `--model`.
  it('offers models (Adaptive included) and no agent-wide effort ladder', () => {
    const adapter = createDevinCliAdapter(createFakeProcessRunner())
    expect(adapter.id).toBe('devin')
    const caps = adapter.capabilities()
    expect(caps.models.length).toBeGreaterThan(1)
    expect(caps.models.map((model) => model.id)).toContain('adaptive')
    // Devin's reasoning levels are *per model* — they ride on each detected
    // model row's own `efforts` (see devinModelCatalog) — so there is no
    // agent-wide ladder to declare.
    expect(caps.efforts).toEqual([])
    expect(caps.supportsAttachments).toBe(true)
  })

  it('always states workspace trust, because print mode cannot ask', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'ok' }], code: 0 })
    const adapter = createDevinCliAdapter(runner, { scratchDir: scratch() })
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'faça isso', resume: 'hushed-leek' })
    await take(session.events, 2)

    const args = runner.calls[0].args
    expect(runner.calls[0].command).toBe('devin')
    // Measured against the real CLI: without this, a folder the user opened in
    // Hive but never opened in Devin's own TUI fails every turn in under a
    // second with "Refusing to run in an untrusted workspace".
    expect(args.join(' ')).toContain('--respect-workspace-trust false')
    expect(args.slice(0, 2)).toEqual(['-p', 'faça isso'])
    expect(args.slice(-2)).toEqual(['--resume', 'hushed-leek'])
    expect(args).not.toContain('--model')
    expect(args).not.toContain('--effort')
  })

  it('folds attachments into the prompt (parity with Claude)', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ code: 0 })
    const adapter = createDevinCliAdapter(runner, { scratchDir: scratch() })
    const session = adapter.startSession({ workspace: '/ws' })

    session.send({ text: 'analisa', attachments: ['docs/prd.md'] })
    await take(session.events, 1)

    const prompt = runner.calls[0].args[1]
    expect(prompt).toContain('<attached-files>')
    expect(prompt).toContain('- docs/prd.md')
  })

  describe('the one --model flag, two picker controls', () => {
    it('sends the chosen reasoning rung, which already names its family', () => {
      // The rung id IS a Devin model id (`claude-opus-5-high`); sending the
      // family slug instead would be the same choice with the level dropped.
      expect(devinModelArg('claude-opus-5', 'claude-opus-5-high')).toBe('claude-opus-5-high')
    })

    it('falls back to the family when the rung is the delegated one', () => {
      expect(devinModelArg('claude-opus-5', '')).toBe('claude-opus-5')
      expect(devinModelArg('claude-opus-5', undefined)).toBe('claude-opus-5')
    })

    it('sends no flag at all when neither was chosen', () => {
      expect(devinModelArg('', '')).toBeUndefined()
      expect(devinModelArg(undefined, undefined)).toBeUndefined()
    })
  })

  describe('session memory', () => {
    /**
     * The reported bug, in one test: "toda vez que mando uma mensagem parece
     * que inicia uma nova sessão". Devin prints no session id in `-p` mode, so
     * nothing downstream ever had a `--resume` handle. `--export` is the one
     * place the CLI states it.
     */
    it('learns the session id from the export and announces it before the turn closes', async () => {
      const dir = scratch()
      const runner = createFakeProcessRunner()
      runner.script({ chunks: [{ stream: 'stdout', data: 'pronto\n' }], code: 0 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: dir })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi', turnId: 'turn-1' })
      // The CLI writes the export as it exits; the fake runner never does, so
      // the test plays that part — the path is the one the adapter chose.
      const exportArg = runner.calls[0].args[runner.calls[0].args.indexOf('--export') + 1]
      writeFileSync(exportArg, JSON.stringify({ session_id: 'witty-vanadium', steps: [] }))

      const events = await take(session.events, 3)
      expect(events[0]).toMatchObject({ type: 'token' })
      // Order matters: the renderer settles the turn on the terminal event and
      // attaches a session id to the turn that raised it, so an id arriving
      // after `done` would have no turn left to land on.
      expect(events[1]).toEqual({ type: 'session', id: 'witty-vanadium', turnId: 'turn-1' })
      expect(events[2]).toMatchObject({ type: 'done', turnId: 'turn-1' })
      // The export is a whole transcript on disk; it carried one string.
      expect(readdirSync(dir)).toEqual([])
    })

    it('says nothing when the export never appeared, and still settles the turn', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: scratch() })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi', turnId: 'turn-1' })
      const events = await take(session.events, 1)
      expect(events[0]).toMatchObject({ type: 'done' })
    })

    it('does not second-guess an id the CLI announced itself', async () => {
      const dir = scratch()
      const runner = createFakeProcessRunner()
      runner.script({
        chunks: [{ stream: 'stdout', data: '{"session_id":"from-stdout","type":"system"}\n' }],
        code: 0
      })
      const adapter = createDevinCliAdapter(runner, { scratchDir: dir })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi', turnId: 'turn-1' })
      const exportArg = runner.calls[0].args[runner.calls[0].args.indexOf('--export') + 1]
      writeFileSync(exportArg, JSON.stringify({ session_id: 'from-export' }))

      const events = await take(session.events, 2)
      expect(events[0]).toEqual({ type: 'session', id: 'from-stdout', turnId: 'turn-1' })
      expect(events[1]).toMatchObject({ type: 'done' })
    })
  })

  describe('readExportedSessionId', () => {
    it('reads the id an export carries', () => {
      const path = join(scratch(), 'export.json')
      writeFileSync(path, JSON.stringify({ schema_version: 'ATIF-v1.7', session_id: 'jewel-sole' }))
      expect(readExportedSessionId(path)).toBe('jewel-sole')
      // Sanity: the fixture really is what the CLI writes.
      expect(JSON.parse(readFileSync(path, 'utf-8')).schema_version).toBe('ATIF-v1.7')
    })

    it('answers null for anything unreadable rather than failing the turn', () => {
      const dir = scratch()
      const broken = join(dir, 'broken.json')
      writeFileSync(broken, 'not json at all')
      expect(readExportedSessionId(broken)).toBeNull()
      expect(readExportedSessionId(join(dir, 'missing.json'))).toBeNull()
      const empty = join(dir, 'empty.json')
      writeFileSync(empty, JSON.stringify({ session_id: '   ' }))
      expect(readExportedSessionId(empty)).toBeNull()
    })
  })

  describe('when the machine gets in the way', () => {
    it('asks the CLI for its capabilities, scoped to the workspace', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ chunks: [{ stream: 'stdout', data: '{"families":[]}' }], code: 0 })
      const adapter = createDevinCliAdapter(runner, {
        host: { env: {}, home: '/home/u', platform: 'linux', readJson: () => null }
      })

      const caps = await adapter.detectCapabilities?.({ workspace: '/ws' })
      expect(runner.calls[0].args).toEqual(['models', 'list', '--format', 'json'])
      expect(runner.calls[0].opts?.cwd).toBe('/ws')
      // An empty listing is no answer, so the curated fallback renders.
      expect(caps?.models.length).toBeGreaterThan(1)
    })

    // A missing session id costs conversation memory; a `--export` pointed at
    // a path the CLI cannot write costs the whole turn. The trade is not close.
    it('omits --export rather than risk the turn on an unwritable directory', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      // A file where the directory should be: `mkdirSync` throws ENOTDIR.
      const blocked = join(scratch(), 'not-a-directory')
      writeFileSync(blocked, 'x')
      const adapter = createDevinCliAdapter(runner, { scratchDir: blocked })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi' })
      await take(session.events, 1)
      expect(runner.calls[0].args).not.toContain('--export')
      expect(runner.calls[0].args.join(' ')).toContain('--respect-workspace-trust false')
    })

    it('cleans up after an interrupted turn too', async () => {
      const dir = scratch()
      const runner = createFakeProcessRunner()
      runner.script({ code: 0, delayMs: 200 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: dir })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi', turnId: 'turn-1' })
      const exportArg = runner.calls[0].args[runner.calls[0].args.indexOf('--export') + 1]
      writeFileSync(exportArg, JSON.stringify({ session_id: 'half-done' }))
      session.interrupt('turn-1')

      const events = await take(session.events, 2)
      // The session id is still worth having: the conversation it names exists
      // on Devin's side and the next message can resume it.
      expect(events[0]).toEqual({ type: 'session', id: 'half-done', turnId: 'turn-1' })
      expect(events[1]).toMatchObject({ type: 'interrupted' })
      expect(readdirSync(dir)).toEqual([])
    })

    it('shrugs off an export file that vanished before cleanup', async () => {
      const dir = scratch()
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: dir })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi' })
      // No file was ever written — the CLI failed before its export.
      const events = await take(session.events, 1)
      expect(events[0]).toMatchObject({ type: 'done' })
    })

    it('reads the real machine when no host facts were injected', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ chunks: [{ stream: 'stdout', data: '{"families":[]}' }], code: 0 })
      const adapter = createDevinCliAdapter(runner)

      // No `deps`, no workspace: every fact comes off `process`/`os`, which is
      // exactly how the app builds it outside a test.
      const caps = await adapter.detectCapabilities?.({})
      expect(caps?.models.length).toBeGreaterThan(1)
      expect(runner.calls[0].opts?.cwd).toBeUndefined()
    })

    it('sends the model the user chose', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: scratch() })
      const session = adapter.startSession({ workspace: '/ws', model: 'claude-opus-5' })

      session.send({ text: 'oi', effort: 'claude-opus-5-max' })
      await take(session.events, 1)
      expect(runner.calls[0].args.join(' ')).toContain('--model claude-opus-5-max')
    })

    it('leaves an export it cannot delete rather than failing the turn', async () => {
      const dir = scratch()
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      const adapter = createDevinCliAdapter(runner, { scratchDir: dir })
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi' })
      // A directory where the export should be: unreadable as JSON and
      // undeletable without `recursive` — both paths at once.
      mkdirSync(runner.calls[0].args[runner.calls[0].args.indexOf('--export') + 1])
      const events = await take(session.events, 1)
      expect(events[0]).toMatchObject({ type: 'done' })
    })

    it('falls back to a temp directory when the app supplied none', async () => {
      const runner = createFakeProcessRunner()
      runner.script({ code: 0 })
      const adapter = createDevinCliAdapter(runner)
      const session = adapter.startSession({ workspace: '/ws' })

      session.send({ text: 'oi' })
      await take(session.events, 1)
      const exportArg = runner.calls[0].args[runner.calls[0].args.indexOf('--export') + 1]
      expect(exportArg.startsWith(tmpdir())).toBe(true)
    })
  })
})
