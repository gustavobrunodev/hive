import { describe, expect, it } from 'vitest'
import {
  configureWhisperEnv,
  ORT_WASM_DIR,
  WHISPER_LOCAL_MODEL_PATH,
  type TransformersEnv
} from './whisperEnv'

function blankEnv(): TransformersEnv {
  return {
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    localModelPath: '',
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
