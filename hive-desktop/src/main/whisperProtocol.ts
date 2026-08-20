import { join, sep } from 'path'

/**
 * The privileged scheme that serves locally-stored Whisper model files to the
 * sandboxed renderer (D-SB-1, design §4.3). The renderer itself never touches
 * the network: main downloads model files into `userData`, and Transformers.js
 * reads them back through this scheme via `env.localModelPath`.
 *
 * **T2-spike corrections baked in here** (see STATE.md):
 * - `corsEnabled: true` is REQUIRED. The renderer is a `file://` origin, and
 *   Chromium refuses a `fetch()` from `file://` to a custom scheme unless that
 *   scheme is CORS-enabled ("Cross origin requests are only supported for
 *   protocol schemes: …"). Without it every model file
 *   fails to load.
 * - The scheme is **host-based**, not path-based: as a `standard` scheme,
 *   `hive-model://models/Xenova/whisper-base/config.json` parses as
 *   host=`models`, pathname=`/Xenova/whisper-base/config.json`. The first
 *   segment is the URL *authority*, so the resolver keys the store root off the
 *   **hostname** and treats the pathname as the rest.
 * - ORT's own WASM assets are NOT served here — they're loaded by dynamic
 *   `import()` (a `script-src` concern) and ship same-origin with the renderer.
 */
export const WHISPER_SCHEME = 'hive-model'

/** Directory name, under `userData`, holding the downloaded model repos. */
export const WHISPER_MODELS_DIRNAME = 'whisper-models'

/**
 * The scheme registration passed to `protocol.registerSchemesAsPrivileged()`
 * **before** `app.whenReady()`. `bypassCSP` stays false: the renderer's CSP
 * explicitly allows `hive-model:` in `connect-src`, so nothing needs bypassing.
 */
export const WHISPER_SCHEME_PRIVILEGES = {
  scheme: WHISPER_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    bypassCSP: false
  }
} as const

/**
 * Store roots addressable by hostname. Today only `models`; the index
 * signature is what lets an arbitrary (attacker-supplied) hostname be looked up
 * safely — an unknown key simply yields `undefined` and the request is refused.
 *
 * A host maps to a **search path**, not a single directory, because the same
 * model can live in two places: the copy a user downloaded into `userData`, and
 * the copy that ships inside the app's `resources/`. Order is priority, and the
 * guard below is applied to each root independently, so adding the bundled
 * directory widens what can be served without widening where a crafted path can
 * reach.
 */
export interface WhisperProtocolRoots {
  models: string | readonly string[]
  [host: string]: string | readonly string[] | undefined
}

/** Contains `file` within `root`? Both traversal shapes are covered — see below. */
function within(root: string, full: string): boolean {
  return full === root || full.startsWith(root.endsWith(sep) ? root : root + sep)
}

/**
 * Every absolute path a `hive-model://<host>/<path>` request may legally read,
 * in priority order. Empty when the host is unknown or the path escapes every
 * root (path-escape guard — the `fsService`/protocol convention).
 *
 * Pure and synchronous so it can be unit-tested exhaustively without Electron;
 * the caller is the one that touches the filesystem to pick the first candidate
 * that exists.
 */
export function resolveWhisperCandidates(roots: WhisperProtocolRoots, url: string): string[] {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return []
  }
  if (parsed.protocol !== `${WHISPER_SCHEME}:`) return []

  const configured = roots[parsed.hostname]
  if (!configured) return []
  const candidates = typeof configured === 'string' ? [configured] : configured
  if (candidates.length === 0) return []

  let rest: string
  try {
    rest = decodeURIComponent(parsed.pathname)
  } catch {
    return [] // malformed percent-encoding
  }
  rest = rest.replace(/^\/+/, '')
  if (rest === '') return []

  // Traversal is neutralized at two layers, and both matter:
  //   1. Literal `../` is resolved away by `new URL()` itself (a `standard`
  //      scheme normalizes the path at parse time), so it can never escape.
  //   2. Percent-encoded `%2e%2e%2f` is opaque to the parser and only becomes
  //      `../` after `decodeURIComponent` above — this explicit guard is what
  //      catches that shape.
  return candidates.flatMap((root) => {
    const full = join(root, rest)
    return within(root, full) ? [full] : []
  })
}

/**
 * The single best path for a request, or `null`. Kept as the narrow form for
 * callers (and tests) that only ever configured one root per host.
 */
export function resolveWhisperRequest(roots: WhisperProtocolRoots, url: string): string | null {
  return resolveWhisperCandidates(roots, url)[0] ?? null
}

/**
 * Headers every model-file response must carry — above all `Content-Length`.
 *
 * `net.fetch(file://…)` answers without one, and that single missing header is
 * what made transcription look broken: Transformers.js logs *"Unable to
 * determine content-length from response headers. Will expand buffer when
 * needed"* and then reads the body by repeatedly reallocating a growing
 * buffer. On the 208 MB fp32 decoder that turns a ~20 s model load into
 * minutes of dead air — the UI sits at "Preparando o modelo… 100%" while the
 * copy grinds. It also means the renderer can't compute honest progress,
 * because the total size is unknown.
 *
 * Kept pure (size in, headers out) so the contract is unit-testable without
 * Electron or a real file.
 */
export function whisperFileHeaders(file: string, size: number): Record<string, string> {
  return {
    'content-length': String(size),
    'content-type': file.endsWith('.json')
      ? 'application/json'
      : file.endsWith('.txt')
        ? 'text/plain'
        : 'application/octet-stream'
  }
}
