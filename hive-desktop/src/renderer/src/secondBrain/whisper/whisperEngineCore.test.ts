import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWhisperEngineCore, type TransformersModule } from './whisperEngineCore'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisperWorkerProtocol'
import type { TransformersEnv } from './whisperEnv'

/**
 * The worker's rules, asserted without a worker.
 *
 * These moved here from `useWhisper.test.ts` when the pipeline moved off the
 * main thread: the device/precision choice, the offline env, the byte-counted
 * load meter and the chunked long-audio call are all the same rules they were,
 * and they matter as much now that the code that holds them cannot be reached
 * from a component test.
 */

function blankEnv(): TransformersEnv {
  return {
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    localModelPath: '',
    fetch: () => Promise.resolve(new Response(null)),
    backends: { onnx: { wasm: { wasmPaths: '' } } }
  }
}

describe('whisperEngineCore', () => {
  let asr: ReturnType<typeof vi.fn>
  let pipeline: ReturnType<typeof vi.fn>
  let env: TransformersEnv
  let streamerOptions: { callback_function?: (text: string) => void }
  let posted: WhisperWorkerResponse[]

  const library = (): TransformersModule =>
    ({
      pipeline,
      env,
      WhisperTextStreamer: class {
        constructor(_tokenizer: unknown, options: { callback_function?: (text: string) => void }) {
          streamerOptions = options
        }
      }
    }) as unknown as TransformersModule

  function core(): ReturnType<typeof createWhisperEngineCore> {
    return createWhisperEngineCore({
      loadLibrary: async () => library(),
      post: (message) => posted.push(message)
    })
  }

  function request(overrides: Partial<Record<string, unknown>> = {}): WhisperWorkerRequest {
    return {
      type: 'transcribe',
      id: 1,
      model: 'base',
      variant: 'fp32',
      device: 'wasm',
      language: 'portuguese',
      baseHref: 'file:///app/index.html',
      pcm: new Float32Array([0.1, 0.2]),
      ...overrides
    } as WhisperWorkerRequest
  }

  beforeEach(() => {
    posted = []
    asr = vi.fn().mockResolvedValue({ text: '  olá squad  ' })
    Object.assign(asr, { tokenizer: { name: 'tok' } })
    pipeline = vi.fn().mockResolvedValue(asr)
    env = blankEnv()
    streamerOptions = {}
  })

  const doneText = (): string | undefined =>
    posted.find(
      (message): message is Extract<WhisperWorkerResponse, { type: 'done' }> =>
        message.type === 'done'
    )?.text

  it('transcribes and trims, reporting the result as `done`', async () => {
    await core().handle(request())
    expect(doneText()).toBe('olá squad')
  })

  it('chunks audio longer than the 30 s window so a long recording cannot blow up memory', async () => {
    // 40 s at 16 kHz — a recording, not a phrase.
    await core().handle(request({ pcm: new Float32Array(40 * 16_000) }))
    expect(asr).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({ chunk_length_s: 30, stride_length_s: 5, language: 'portuguese' })
    )
  })

  // The chunked path builds strided buffers and stitches overlapping windows
  // back together. On a dictated phrase — which fits one window whole — all of
  // that is surplus allocation on a WASM heap that only grows, and surplus
  // allocation is what "std::bad_alloc" is made of.
  it('does not chunk a phrase that already fits one window', async () => {
    await core().handle(request({ pcm: new Float32Array(9 * 16_000) }))
    const options = asr.mock.calls[0]?.[1] as Record<string, unknown>
    expect(options.chunk_length_s).toBeUndefined()
    expect(options.stride_length_s).toBeUndefined()
    expect(options.language).toBe('portuguese')
  })

  it('disposes the outgoing pipeline before building the one that replaces it', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined)
    Object.assign(asr, { dispose })
    const engine = core()

    await engine.handle(request())
    expect(dispose).not.toHaveBeenCalled() // same key — the warm one is reused

    await engine.handle(request({ model: 'small' }))
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(pipeline).toHaveBeenCalledTimes(2)
  })

  it('survives a pipeline that refuses to dispose', async () => {
    Object.assign(asr, { dispose: vi.fn().mockRejectedValue(new Error('nope')) })
    const engine = core()
    await engine.handle(request())
    await engine.handle(request({ model: 'small' }))
    expect(doneText()).toBe('olá squad')
  })

  describe('an exhausted WASM heap', () => {
    const oom = 'failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc'

    const errors = (): Extract<WhisperWorkerResponse, { type: 'error' }>[] =>
      posted.filter(
        (m): m is Extract<WhisperWorkerResponse, { type: 'error' }> => m.type === 'error'
      )

    it('is reported as `kind: memory`, so the client knows to replace the thread', async () => {
      asr.mockRejectedValue(new Error(oom))
      await core().handle(request())
      expect(errors()[0]?.kind).toBe('memory')
    })

    it('drops the poisoned pipeline, so the next attempt rebuilds rather than reusing it', async () => {
      const engine = core()
      asr.mockRejectedValueOnce(new Error(oom))
      await engine.handle(request())
      asr.mockResolvedValue({ text: 'de novo' })
      await engine.handle(request())
      expect(pipeline).toHaveBeenCalledTimes(2)
    })

    it('leaves an ordinary failure alone — that one is retryable as it is', async () => {
      asr.mockRejectedValue(new Error('audio is silent'))
      await core().handle(request())
      expect(errors()[0]?.kind).toBeUndefined()
    })
  })

  it('runs fp32 on WASM — the quantized decoder cannot build a session there', async () => {
    await core().handle(request({ variant: 'fp32', device: 'wasm' }))
    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'base',
      expect.objectContaining({ device: 'wasm', dtype: 'fp32' })
    )
  })

  it('runs q8 when the client resolved a WebGPU device', async () => {
    await core().handle(request({ variant: 'q8', device: 'webgpu' }))
    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'base',
      expect.objectContaining({ device: 'webgpu', dtype: 'q8' })
    )
  })

  it('applies the proven offline env against the RENDERER base, not its own URL', async () => {
    await core().handle(request())
    expect(env.allowRemoteModels).toBe(false)
    expect(env.localModelPath).toBe('hive-model://models/')
    // The whole reason `baseHref` rides on the message: the worker's own URL
    // sits in `assets/`, and `assets/ort/` does not exist.
    expect(env.backends.onnx.wasm.wasmPaths).toBe('file:///app/ort/')
  })

  it('builds the pipeline once and reuses it for the same model', async () => {
    const engine = core()
    await engine.handle(request({ id: 1 }))
    await engine.handle(request({ id: 2 }))
    expect(pipeline).toHaveBeenCalledTimes(1)
    expect(asr).toHaveBeenCalledTimes(2)
  })

  it('rebuilds when a different model is asked for', async () => {
    const engine = core()
    await engine.handle(request({ id: 1, model: 'base' }))
    await engine.handle(request({ id: 2, model: 'small' }))
    expect(pipeline).toHaveBeenCalledTimes(2)
  })

  /**
   * A pre-warm is a build and nothing else — no audio, no inference. The old
   * pre-warm pushed a tenth of a second of silence through `transcribe`, which
   * cost a real pass and took the pipeline slot the first phrase then queued
   * behind.
   */
  it('warms by building the pipeline without transcribing anything', async () => {
    await core().handle({
      type: 'warm',
      id: 7,
      model: 'base',
      variant: 'fp32',
      device: 'wasm',
      baseHref: 'file:///app/index.html'
    })
    expect(pipeline).toHaveBeenCalledTimes(1)
    expect(asr).not.toHaveBeenCalled()
    expect(doneText()).toBe('')
  })

  it('a warm followed by a transcription is ONE build', async () => {
    const engine = core()
    await engine.handle({
      type: 'warm',
      id: 1,
      model: 'base',
      variant: 'fp32',
      device: 'wasm',
      baseHref: 'file:///app/index.html'
    })
    await engine.handle(request({ id: 2 }))
    expect(pipeline).toHaveBeenCalledTimes(1)
  })

  it('forwards decoded text as it arrives, before the result exists', async () => {
    asr.mockImplementation(async () => {
      streamerOptions.callback_function?.('Olá')
      streamerOptions.callback_function?.(' squad')
      return { text: 'Olá squad' }
    })
    await core().handle(request())
    const partials = posted.filter((message) => message.type === 'partial')
    expect(partials).toEqual([
      { type: 'partial', id: 1, text: 'Olá' },
      { type: 'partial', id: 1, text: ' squad' }
    ])
  })

  it('reports loading, then warming once every weight byte is in, then idle', async () => {
    pipeline.mockImplementation(async () => {
      // The meter is installed around this call; reading through the library's
      // own fetch is what produces the phases.
      const response = await env.fetch('hive-model://models/base/onnx/encoder_model.onnx')
      await response.arrayBuffer()
      return asr
    })
    env.fetch = () =>
      Promise.resolve(new Response(new Uint8Array(100), { headers: { 'content-length': '100' } }))

    await core().handle(request())
    const phases = posted
      .filter(
        (message): message is Extract<WhisperWorkerResponse, { type: 'phase' }> =>
          message.type === 'phase'
      )
      .map((message) => message.phase.status)
    expect(phases[0]).toBe('loading')
    expect(phases).toContain('warming')
    expect(phases).toContain('transcribing')
    expect(phases[phases.length - 1]).toBe('idle')
  })

  /**
   * `progress_callback` is never passed. Passing it makes Transformers.js v4
   * probe every weight file with a second, never-read GET first — measured in
   * the real app: two requests per `.onnx`, one left hanging.
   */
  it('measures the load through env.fetch instead of asking the library', async () => {
    let passed: unknown = 'not-called'
    let wrapped: unknown = null
    const original = env.fetch
    pipeline.mockImplementation(async (_task, _repo, options: Record<string, unknown>) => {
      passed = options.progress_callback
      wrapped = env.fetch
      return asr
    })
    await core().handle(request())
    expect(passed).toBeUndefined()
    expect(wrapped).not.toBe(original)
  })

  it("puts the library's own fetch back when the pipeline throws", async () => {
    const original = env.fetch
    pipeline.mockRejectedValue(new Error('Array buffer allocation failed'))
    await core().handle(request())
    expect(env.fetch).toBe(original)
  })

  it('posts a failure instead of throwing, so the worker survives it', async () => {
    asr.mockRejectedValue(new Error('session create failed'))
    await expect(core().handle(request())).resolves.toBeUndefined()
    expect(posted).toContainEqual({ type: 'error', id: 1, message: 'session create failed' })
  })

  it('keeps a non-Error rejection legible', async () => {
    asr.mockRejectedValue('plain string failure')
    await core().handle(request())
    expect(posted).toContainEqual({ type: 'error', id: 1, message: 'plain string failure' })
  })

  it('returns an empty string when the model produced no text field', async () => {
    asr.mockResolvedValue({})
    await core().handle(request())
    expect(doneText()).toBe('')
  })
})
