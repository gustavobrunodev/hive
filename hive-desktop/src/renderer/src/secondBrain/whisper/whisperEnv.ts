/**
 * The exact Transformers.js environment the T2 spike proved works inside this
 * app's sandboxed, CSP-restricted, offline renderer (see STATE.md for the full
 * account). Every line here is load-bearing — changing one silently breaks
 * transcription in a way unit tests can't catch, so they're spelled out with
 * their reasons.
 */

/** A `fetch`-shaped callable — the one the library reads model bytes through. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** Shape of the bits of `@huggingface/transformers`'s `env` we configure. */
export interface TransformersEnv {
  allowRemoteModels: boolean
  allowLocalModels: boolean
  useBrowserCache: boolean
  localModelPath: string
  /** The library's own fetch. Replaceable — that is how loading is measured. */
  fetch: FetchLike
  backends: { onnx: { wasm: { wasmPaths: string; numThreads?: number } } }
}

/** One file's read, as `installLoadMeter` reports it. */
export interface LoadedFile {
  /** Bytes read so far. */
  loaded: number
  /** Total bytes, from `Content-Length` (`0` when the header is absent). */
  total: number
  /** Has the body been read to the end? */
  done: boolean
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

/**
 * Measures the model load by counting the bytes the library actually reads,
 * **instead of** asking it for progress.
 *
 * Asking is what broke. Passing `progress_callback` to `pipeline()` makes
 * Transformers.js v4 first probe every expected file's metadata — and for a
 * non-http model path (which `hive-model:` is) that probe is a **full GET**
 * whose body it never reads, purely to look at `Content-Length`. Measured in
 * the real app on 2026-08-23: every weight file was requested twice, one of the
 * two left hanging. On `medium` that is a 1.7 GB response held open for the
 * life of the window — an open file handle in main that Windows will not let
 * the user delete the model through, and a second copy of the bytes in flight
 * while the first is being turned into a session.
 *
 * Counting is strictly better anyway: it reports the bytes that are *really*
 * arriving, from the same stream the library consumes, with no second request
 * to make it possible.
 *
 * Returns the uninstall, so a caller can put the original `fetch` back.
 */
export function installLoadMeter(
  env: TransformersEnv,
  onChange: (files: Map<string, LoadedFile>) => void
): () => void {
  const original = env.fetch
  const files = new Map<string, LoadedFile>()

  env.fetch = async (input, init) => {
    const response = await original(input, init)
    const total = Number(response.headers.get('content-length') ?? 0)
    const body = response.body
    if (body === null || !response.ok) return response

    const key = String(input instanceof Request ? input.url : input)
    const entry: LoadedFile = { loaded: 0, total, done: false }
    files.set(key, entry)
    onChange(files)

    // A pass-through, not a buffer: the bytes are counted as they flow to the
    // library, so nothing is held twice and a 900 MB read still peaks at one
    // copy.
    const counted = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = body.getReader()
        try {
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) break
            entry.loaded += chunk.value.byteLength
            onChange(files)
            controller.enqueue(chunk.value)
          }
          entry.done = true
          onChange(files)
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
      cancel(reason) {
        void body.cancel(reason)
      }
    })

    return new Response(counted, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  return () => {
    env.fetch = original
  }
}

/**
 * The load as one percentage, capped at 99 while anything is still arriving.
 *
 * "100 %" is a promise the next phase has to keep, and claiming it early is
 * what made the wait feel broken before. Files without a `Content-Length` are
 * left out of the denominator rather than counted as zero — a config file
 * whose size is unknown must not drag a 900 MB read's percentage down.
 */
export function loadPercent(files: Map<string, LoadedFile>): number {
  let loaded = 0
  let total = 0
  for (const file of files.values()) {
    if (file.total <= 0) continue
    loaded += Math.min(file.loaded, file.total)
    total += file.total
  }
  if (total === 0) return 0
  return Math.min(99, Math.round((loaded / total) * 100))
}

/**
 * Is every byte in, with at least one real weight file among them?
 *
 * The weight check is the load-bearing half: the tokenizer and the three config
 * files land in the first few hundred milliseconds, and "everything I have seen
 * is finished" is true at that moment too — which would flip the UI to
 * "building the session" before the 900 MB read had even started.
 */
export function weightsLoaded(files: Map<string, LoadedFile>): boolean {
  let weights = false
  for (const [url, file] of files) {
    if (!file.done) return false
    if (/\.onnx(_data)?$/.test(url)) weights = true
  }
  return weights
}
