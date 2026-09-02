import { describe, expect, it, vi } from 'vitest'
import { AsrError, createAsrEngine, type AsrChild, type AsrEngine } from './asrProcess'
import type { AsrEnginePhase, AsrModelPaths, AsrWorkerResponse } from './asrWorkerProtocol'

const PATHS: AsrModelPaths = {
  encoder: '/m/encoder.int8.onnx',
  decoder: '/m/decoder.int8.onnx',
  joiner: '/m/joiner.int8.onnx',
  tokens: '/m/tokens.txt'
}

interface Fake {
  engine: AsrEngine
  sent: unknown[]
  forks: number
  killed: number
  reply: (message: AsrWorkerResponse) => void
  exit: () => void
  phases: AsrEnginePhase[]
}

function fake(options: { paths?: AsrModelPaths | null } = {}): Fake {
  const sent: unknown[] = []
  const phases: AsrEnginePhase[] = []
  let onMessage: ((event: { data: AsrWorkerResponse }) => void) | null = null
  let onExit: (() => void) | null = null
  let forks = 0
  let killed = 0

  const child: AsrChild = {
    postMessage: (message) => sent.push(message),
    on: (event, listener) => {
      if (event === 'message') onMessage = listener as unknown as typeof onMessage
      else onExit = listener as unknown as typeof onExit
    },
    kill: () => {
      killed += 1
    }
  }

  const engine = createAsrEngine({
    fork: () => {
      forks += 1
      return child
    },
    specifier: () => 'sherpa-onnx-node',
    paths: () => (options.paths === undefined ? PATHS : options.paths),
    threads: () => 3
  })
  engine.subscribe((phase) => phases.push(phase))

  return {
    engine,
    sent,
    phases,
    get forks() {
      return forks
    },
    get killed() {
      return killed
    },
    reply: (message) => onMessage?.({ data: message }),
    exit: () => onExit?.()
  }
}

describe('createAsrEngine', () => {
  it('does not fork until something is actually asked of it', () => {
    const f = fake()
    expect(f.forks).toBe(0)
    void f.engine.transcribe(new Float32Array(16_000))
    expect(f.forks).toBe(1)
  })

  it('tells the worker which addon specifier to require, before anything else', () => {
    const f = fake()
    void f.engine.warm()
    expect(f.sent[0]).toEqual({ type: 'configure', specifier: 'sherpa-onnx-node' })
  })

  it('resolves a transcription by request id', async () => {
    const f = fake()
    const first = f.engine.transcribe(new Float32Array(16_000))
    const second = f.engine.transcribe(new Float32Array(16_000))
    // Answered out of order on purpose: the ids are the correlation, not arrival.
    f.reply({ type: 'done', id: 2, text: 'segundo' })
    f.reply({ type: 'done', id: 1, text: 'primeiro' })
    await expect(first).resolves.toBe('primeiro')
    await expect(second).resolves.toBe('segundo')
  })

  it('carries the failure kind out to the caller', async () => {
    const f = fake()
    const run = f.engine.transcribe(new Float32Array(16_000))
    f.reply({ type: 'error', id: 1, message: 'files missing', kind: 'model' })
    await expect(run).rejects.toThrow(AsrError)
    await run.catch((error: AsrError) => expect(error.kind).toBe('model'))
  })

  it('reads the model paths per request, so a late download needs no restart', async () => {
    let paths: AsrModelPaths | null = null
    const engine = createAsrEngine({
      fork: () => ({ postMessage: () => {}, on: () => {}, kill: () => {} }),
      specifier: () => 's',
      paths: () => paths,
      threads: () => 2
    })
    await expect(engine.transcribe(new Float32Array(16_000))).rejects.toMatchObject({
      kind: 'model'
    })
    paths = PATHS
    // The very next phrase works, with nothing rebuilt and nothing restarted.
    void engine.transcribe(new Float32Array(16_000))
  })

  it('joins a second warm onto the first instead of building twice', async () => {
    const f = fake()
    const a = f.engine.warm()
    const b = f.engine.warm()
    const warms = f.sent.filter((m) => (m as { type: string }).type === 'warm')
    // Two sessions is 3.6 s and 2 GB — this is the defect `whisperClient` was
    // created to fix, and it costs more here.
    expect(warms).toHaveLength(1)
    f.reply({ type: 'done', id: 1, text: '' })
    await Promise.all([a, b])
  })

  it('lets a failed warm be retried', async () => {
    const f = fake()
    const first = f.engine.warm()
    f.reply({ type: 'error', id: 1, message: 'boom', kind: 'runtime' })
    await expect(first).rejects.toThrow('boom')
    void f.engine.warm()
    expect(f.sent.filter((m) => (m as { type: string }).type === 'warm')).toHaveLength(2)
  })

  it('fails everything in flight when the process dies, and says so', async () => {
    const f = fake()
    const run = f.engine.transcribe(new Float32Array(16_000))
    f.exit()
    await expect(run).rejects.toThrow('the transcription process stopped')
    expect(f.phases.at(-1)).toEqual({
      status: 'error',
      message: 'the transcription process stopped'
    })
  })

  it('re-forks after a crash rather than staying dead', async () => {
    const f = fake()
    f.engine.transcribe(new Float32Array(16_000)).catch(() => {})
    f.exit()
    await Promise.resolve()
    void f.engine.transcribe(new Float32Array(16_000))
    expect(f.forks).toBe(2)
  })

  it('publishes the worker’s phases to subscribers', () => {
    const f = fake()
    void f.engine.warm()
    f.reply({ type: 'phase', phase: { status: 'loading' } })
    f.reply({ type: 'phase', phase: { status: 'ready' } })
    expect(f.phases.map((p) => p.status)).toEqual(['loading', 'ready'])
    expect(f.engine.phase()).toEqual({ status: 'ready' })
  })

  it('ignores a reply to a request it is no longer carrying', () => {
    const f = fake()
    expect(() => f.reply({ type: 'done', id: 999, text: 'ghost' })).not.toThrow()
  })

  it('evicts only when a process exists', () => {
    const f = fake()
    f.engine.evict()
    expect(f.sent).toHaveLength(0)
    void f.engine.warm()
    f.engine.evict()
    expect(f.sent.some((m) => (m as { type: string }).type === 'evict')).toBe(true)
  })

  it('kills the process and drops the listeners on dispose', () => {
    const f = fake()
    f.engine.warm().catch(() => {})
    f.engine.dispose()
    expect(f.killed).toBe(1)
  })

  it('rejects a post that throws instead of leaving the promise hanging', async () => {
    const engine = createAsrEngine({
      fork: () => ({
        postMessage: vi.fn().mockImplementation((message: { type: string }) => {
          if (message.type === 'transcribe') throw new Error('channel closed')
        }),
        on: () => {},
        kill: () => {}
      }),
      specifier: () => 's',
      paths: () => PATHS,
      threads: () => 2
    })
    await expect(engine.transcribe(new Float32Array(16_000))).rejects.toThrow('channel closed')
  })
})
