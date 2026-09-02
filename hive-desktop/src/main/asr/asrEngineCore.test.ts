import { describe, expect, it, vi } from 'vitest'
import {
  createAsrEngineCore,
  failureKind,
  recognizerConfig,
  IDLE_EVICT_MS,
  MIN_DECODE_SAMPLES,
  SAMPLE_RATE,
  type SherpaModule,
  type SherpaRecognizer
} from './asrEngineCore'
import type { AsrModelPaths, AsrWorkerResponse } from './asrWorkerProtocol'

/**
 * The engine's rules, asserted without the native addon.
 *
 * Everything here is reachable only because `sherpa-onnx-node` is injected: the
 * real one would load a 652 MB encoder and take ~1.8 s per construction, which
 * is exactly the cost these rules exist to manage.
 */

const PATHS: AsrModelPaths = {
  encoder: '/m/encoder.int8.onnx',
  decoder: '/m/decoder.int8.onnx',
  joiner: '/m/joiner.int8.onnx',
  tokens: '/m/tokens.txt'
}

interface Harness {
  core: ReturnType<typeof createAsrEngineCore>
  posted: AsrWorkerResponse[]
  built: Record<string, unknown>[]
  clock: { value: number }
  accepted: { sampleRate: number; samples: Float32Array }[]
  decoded: boolean[]
}

function harness(options: { text?: string; exists?: boolean; throwOnBuild?: Error } = {}): Harness {
  const posted: AsrWorkerResponse[] = []
  const built: Record<string, unknown>[] = []
  const accepted: { sampleRate: number; samples: Float32Array }[] = []
  const decoded: boolean[] = []
  const clock = { value: 1_000 }

  const addon: SherpaModule = {
    OfflineRecognizer: class {
      constructor(config: Record<string, unknown>) {
        if (options.throwOnBuild) throw options.throwOnBuild
        built.push(config)
      }
      createStream(): {
        acceptWaveform: (w: { sampleRate: number; samples: Float32Array }) => void
      } {
        return { acceptWaveform: (wave) => accepted.push(wave) }
      }
      decode(): void {
        decoded.push(true)
      }
      getResult(): { text: string } {
        return { text: options.text ?? '  olá mundo  ' }
      }
    } as unknown as new (config: Record<string, unknown>) => SherpaRecognizer
  }

  const core = createAsrEngineCore({
    loadAddon: () => addon,
    post: (message) => posted.push(message),
    filesExist: () => options.exists ?? true,
    now: () => clock.value
  })
  return { core, posted, built, clock, accepted, decoded }
}

const pcm = (samples: number): Float32Array => new Float32Array(samples).fill(0.1)
const texts = (posted: AsrWorkerResponse[]): string[] =>
  posted.flatMap((m) => (m.type === 'done' ? [m.text] : []))
const phases = (posted: AsrWorkerResponse[]): string[] =>
  posted.flatMap((m) => (m.type === 'phase' ? [m.phase.status] : []))

describe('asrEngineCore', () => {
  it('builds the recognizer once and reuses it across phrases', () => {
    const h = harness()
    h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    h.core.handle({ type: 'transcribe', id: 2, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    // The 1.8 s session build is the whole reason the engine is a process and
    // not a function: paying it twice for two phrases is the failure mode.
    expect(h.built).toHaveLength(1)
    expect(texts(h.posted)).toEqual(['olá mundo', 'olá mundo'])
  })

  it('rebuilds when the thread count changes', () => {
    const h = harness()
    h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    h.core.handle({ type: 'transcribe', id: 2, paths: PATHS, threads: 2, pcm: pcm(SAMPLE_RATE) })
    expect(h.built).toHaveLength(2)
  })

  it('answers audio shorter than the decode floor without building anything', () => {
    const h = harness()
    h.core.handle({
      type: 'transcribe',
      id: 1,
      paths: PATHS,
      threads: 4,
      pcm: pcm(MIN_DECODE_SAMPLES - 1)
    })
    // A transducer fed a fragment invents a word rather than failing, and the
    // live pass offers the open phrase from its first moments — so this bound
    // is hit routinely, and building the engine for it would be worse still.
    expect(texts(h.posted)).toEqual([''])
    expect(h.built).toHaveLength(0)
  })

  it('warms without transcribing, and reports ready', () => {
    const h = harness()
    h.core.handle({ type: 'warm', id: 1, paths: PATHS, threads: 4 })
    expect(h.built).toHaveLength(1)
    expect(h.accepted).toHaveLength(0)
    expect(h.decoded).toHaveLength(0)
    expect(phases(h.posted)).toEqual(['loading', 'ready'])
  })

  it('hands the PCM over at the fixed 16 kHz the transport delivers', () => {
    const h = harness()
    const samples = pcm(SAMPLE_RATE * 2)
    h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: samples })
    expect(h.accepted).toEqual([{ sampleRate: SAMPLE_RATE, samples }])
  })

  it('names the TDT decode loop and greedy search in the config', () => {
    const config = recognizerConfig(PATHS, 3) as {
      modelConfig: { modelType: string; numThreads: number }
      decodingMethod: string
    }
    // `modelType` is what selects sherpa's token-and-duration loop over a plain
    // RNN-T one; greedy is what keeps a phrase ahead of the next one.
    expect(config.modelConfig.modelType).toBe('nemo_transducer')
    expect(config.modelConfig.numThreads).toBe(3)
    expect(config.decodingMethod).toBe('greedy_search')
  })

  it('calls a missing weight a model failure, not a runtime one', () => {
    const h = harness({ exists: false })
    h.core.handle({ type: 'transcribe', id: 7, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    const error = h.posted.find((m) => m.type === 'error')
    expect(error).toMatchObject({ id: 7, kind: 'model' })
    // Downloading it again fixes this; retrying does not.
    expect(failureKind(new Error('anything'), false)).toBe('model')
  })

  it('calls an addon that throws a runtime failure', () => {
    const h = harness({ throwOnBuild: new Error('failed to create session') })
    h.core.handle({ type: 'transcribe', id: 9, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    expect(h.posted.find((m) => m.type === 'error')).toMatchObject({ id: 9, kind: 'runtime' })
  })

  it('never throws out of handle', () => {
    const h = harness({ throwOnBuild: new Error('boom') })
    expect(() =>
      h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    ).not.toThrow()
  })

  it('keeps the session through an idle spell shorter than the evict window', () => {
    const h = harness()
    h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    h.clock.value += IDLE_EVICT_MS - 1
    h.core.sweep()
    h.core.handle({ type: 'transcribe', id: 2, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    // Phrases inside one dictation session are seconds apart; none of them may
    // pay the rebuild.
    expect(h.built).toHaveLength(1)
  })

  it('drops the ~1 GB of weights once the engine has gone idle', () => {
    const h = harness()
    h.core.handle({ type: 'transcribe', id: 1, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    h.clock.value += IDLE_EVICT_MS
    h.core.sweep()
    expect(phases(h.posted).at(-1)).toBe('idle')
    h.core.handle({ type: 'transcribe', id: 2, paths: PATHS, threads: 4, pcm: pcm(SAMPLE_RATE) })
    expect(h.built).toHaveLength(2)
  })

  it('evicts on request', () => {
    const h = harness()
    h.core.handle({ type: 'warm', id: 1, paths: PATHS, threads: 4 })
    h.core.handle({ type: 'evict', id: 2 })
    h.core.handle({ type: 'warm', id: 3, paths: PATHS, threads: 4 })
    expect(h.built).toHaveLength(2)
  })

  it('loads the addon lazily — a process that never transcribes never pays', () => {
    const loadAddon = vi.fn(() => {
      throw new Error('should not be called')
    })
    const core = createAsrEngineCore({
      loadAddon: loadAddon as unknown as () => SherpaModule,
      post: () => {},
      filesExist: () => true
    })
    core.sweep()
    expect(loadAddon).not.toHaveBeenCalled()
  })
})
