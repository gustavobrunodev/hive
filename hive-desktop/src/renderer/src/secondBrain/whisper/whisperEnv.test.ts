import { describe, expect, it, vi } from 'vitest'
import {
  configureWhisperEnv,
  installLoadMeter,
  loadPercent,
  ORT_WASM_DIR,
  weightsLoaded,
  WHISPER_LOCAL_MODEL_PATH,
  type TransformersEnv
} from './whisperEnv'

function blankEnv(): TransformersEnv {
  return {
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    localModelPath: '',
    // The library's fetch — replaceable, which is how the load meter measures.
    fetch: () => Promise.resolve(new Response(null)),
    backends: { onnx: { wasm: { wasmPaths: '' } } }
  }
}

/**
 * These assertions encode the four T2-spike corrections (STATE.md). They read
 * like trivia until one regresses and transcription silently stops working, so
 * each one names the failure it prevents.
 */
describe('whisperEnv', () => {
  it('keeps the renderer offline — no remote models, local only', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'file:///app/index.html')
    expect(env.allowRemoteModels).toBe(false)
    expect(env.allowLocalModels).toBe(true)
  })

  it('disables the browser cache (a hive-model: response cannot be stored in the Cache API)', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'file:///app/index.html')
    expect(env.useBrowserCache).toBe(false)
  })

  it('points localModelPath at the HOST-based scheme, not hive-model:///', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'file:///app/index.html')
    // A `standard` scheme parses the first segment as the authority: with
    // `hive-model:///` the model repo owner would become the host and the
    // protocol handler would reject every request.
    expect(env.localModelPath).toBe(WHISPER_LOCAL_MODEL_PATH)
    expect(env.localModelPath).toBe('hive-model://models/')
    expect(env.localModelPath.startsWith('hive-model:///')).toBe(false)
    expect(env.localModelPath.endsWith('/')).toBe(true)
  })

  it('resolves ORT wasmPaths SAME-ORIGIN, never through hive-model:', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'file:///app/renderer/index.html')
    // ORT's glue loads via dynamic import() (script-src), so a custom scheme
    // fails outright — it has to sit next to the renderer bundle.
    expect(env.backends.onnx.wasm.wasmPaths).toBe(`file:///app/renderer/${ORT_WASM_DIR}`)
    expect(env.backends.onnx.wasm.wasmPaths.includes('hive-model:')).toBe(false)
  })

  it('pins a single WASM thread (no cross-origin isolation → no SharedArrayBuffer)', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'file:///app/index.html')
    expect(env.backends.onnx.wasm.numThreads).toBe(1)
  })

  it('resolves wasmPaths relative to whatever base the renderer is served from', () => {
    const env = blankEnv()
    configureWhisperEnv(env, 'http://localhost:5173/index.html')
    expect(env.backends.onnx.wasm.wasmPaths).toBe('http://localhost:5173/ort/')
  })
})

/**
 * The load meter replaces `progress_callback`, which is not a style choice:
 * passing that option makes Transformers.js v4 probe every weight file with a
 * second, never-read GET first. Measured in the real app on 2026-08-23 — two
 * requests per `.onnx`, one left hanging, which on `medium` is a 1.7 GB
 * response held open for the life of the window (and an open file handle in
 * main that Windows will not let the user delete the model through).
 */
describe('installLoadMeter', () => {
  function streamed(bytes: number[], total: number): Response {
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const size of bytes) controller.enqueue(new Uint8Array(size))
          controller.close()
        }
      }),
      { headers: { 'content-length': String(total) } }
    )
  }

  it('counts the bytes the library reads, once, and passes them straight through', async () => {
    const env = blankEnv()
    const original = vi.fn(() => Promise.resolve(streamed([40, 60], 100)))
    env.fetch = original
    const seen: number[] = []
    installLoadMeter(env, (files) => seen.push(loadPercent(files)))

    const response = await env.fetch('hive-model://models/base/onnx/encoder_model.onnx')
    const body = await response.arrayBuffer()

    expect(body.byteLength).toBe(100)
    expect(original).toHaveBeenCalledTimes(1)
    // 0 on open, then 40 %, then capped at 99 — never 100 while the next phase
    // still has work to do.
    expect(seen).toEqual([0, 40, 99, 99])
  })

  it('says the weights are in only once a real weight file has finished', async () => {
    const env = blankEnv()
    const answers = new Map([
      ['hive-model://models/base/tokenizer.json', () => streamed([10], 10)],
      ['hive-model://models/base/onnx/encoder_model.onnx', () => streamed([90], 90)]
    ])
    env.fetch = (input) => Promise.resolve(answers.get(String(input))!())
    let latest = new Map<string, { loaded: number; total: number; done: boolean }>()
    installLoadMeter(env, (files) => {
      latest = new Map(files)
    })

    await (await env.fetch('hive-model://models/base/tokenizer.json')).arrayBuffer()
    // Everything seen so far is finished — but none of it is a weight file, and
    // flipping to "building the session" here is exactly the lie the old
    // `seen.size === finished.size` rule told.
    expect(weightsLoaded(latest)).toBe(false)

    await (await env.fetch('hive-model://models/base/onnx/encoder_model.onnx')).arrayBuffer()
    expect(weightsLoaded(latest)).toBe(true)
  })

  it('leaves a response it cannot measure exactly as it found it', async () => {
    const env = blankEnv()
    const notFound = new Response(null, { status: 404 })
    env.fetch = () => Promise.resolve(notFound)
    installLoadMeter(env, () => {})

    expect(await env.fetch('hive-model://models/base/missing.json')).toBe(notFound)
  })

  it('puts the original fetch back on uninstall', () => {
    const env = blankEnv()
    const original = env.fetch
    installLoadMeter(env, () => {})()
    expect(env.fetch).toBe(original)
  })
})

describe('loadPercent', () => {
  it('ignores files whose size the response never declared', () => {
    const files = new Map([
      ['a', { loaded: 5, total: 0, done: true }],
      ['b', { loaded: 500, total: 1000, done: false }]
    ])
    expect(loadPercent(files)).toBe(50)
  })

  it('is 0 rather than NaN before anything with a size has arrived', () => {
    expect(loadPercent(new Map())).toBe(0)
  })
})
