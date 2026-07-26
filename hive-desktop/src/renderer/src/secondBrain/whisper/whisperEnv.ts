/**
 * The exact Transformers.js environment the T2 spike proved works inside this
 * app's sandboxed, CSP-restricted, offline renderer (see STATE.md for the full
 * account). Every line here is load-bearing — changing one silently breaks
 * transcription in a way unit tests can't catch, so they're spelled out with
 * their reasons.
 */

/** Shape of the bits of `@huggingface/transformers`'s `env` we configure. */
export interface TransformersEnv {
  allowRemoteModels: boolean
  allowLocalModels: boolean
  useBrowserCache: boolean
  localModelPath: string
  backends: { onnx: { wasm: { wasmPaths: string; numThreads?: number } } }
}

/**
 * Where model files come from: the privileged `hive-model:` scheme, whose
 * **host** selects the store root (`models`) — a `standard` scheme parses the
 * first segment as the URL authority, so `hive-model:///` (three slashes)
 * would make the repo owner the host instead. Trailing slash matters:
 * Transformers.js concatenates `<localModelPath><repo>/<file>`.
 */
export const WHISPER_LOCAL_MODEL_PATH = 'hive-model://models/'

/** Same-origin directory the ORT WASM binaries are copied into at build time. */
export const ORT_WASM_DIR = 'ort/'

/**
 * Applies the proven configuration to a Transformers.js `env`. Pure and
 * injectable so it can be asserted in a unit test without importing the real
 * (multi-megabyte, WASM-loading) library.
 */
export function configureWhisperEnv(env: TransformersEnv, baseHref: string): void {
  // The renderer must NEVER reach the network: main downloads model files into
  // userData and serves them back over `hive-model:` (the sandbox contract).
  env.allowRemoteModels = false
  env.allowLocalModels = true
  // The Cache API cannot store a `hive-model:` response ("Request scheme
  // 'hive-model' is unsupported") and our userData store already IS the cache,
  // so browser caching would only produce console noise.
  env.useBrowserCache = false
  env.localModelPath = WHISPER_LOCAL_MODEL_PATH
  // ORT's `.mjs` glue is loaded by dynamic import() → governed by `script-src`,
  // so it must be same-origin; a `hive-model:` URL here fails to load at all.
  env.backends.onnx.wasm.wasmPaths = new URL(ORT_WASM_DIR, baseHref).href
  // The renderer isn't cross-origin isolated (no COOP/COEP headers on a
  // file:// page), so SharedArrayBuffer — and thus ORT's multi-threaded WASM —
  // is unavailable; pinning one thread avoids a failed thread-pool spin-up.
  env.backends.onnx.wasm.numThreads = 1
}
