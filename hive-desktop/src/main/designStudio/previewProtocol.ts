import { join, sep } from 'path'

/**
 * Design Studio (M18) — T3.1. The privileged scheme that serves the Preview.
 *
 * Modelled on `whisperProtocol.ts` almost line for line (design §2): a scheme
 * declared privileged *before* `app.whenReady()`, a pure host-based resolver
 * with a path-escape guard, and headers computed by a pure function so the
 * contract is testable without Electron. Two things differ, and both are
 * deliberate:
 *
 *  - **The root is build-time, not runtime.** Whisper serves model files the
 *    user downloaded into `userData`; the Studio serves artifacts that shipped
 *    with the app (`resources/`), so nothing under this scheme is ever
 *    attacker-writable.
 *  - **One host, not one per store.** The Preview document and every asset it
 *    loads must share an origin, because the response CSP says
 *    `script-src 'self'` (P1-Preview AC-2) and `'self'` is scheme+host+port.
 *    Splitting the DS bundle and the in-frame receiver across two hosts would
 *    make the document unable to load either. So there is exactly one
 *    addressable host, `preview`, rooted at `resources/`, and the sub-paths
 *    (`design-system-web-awesome/…`, `design-studio-preview/…`) are ordinary
 *    directories under it.
 *
 * The iframe that renders this is `sandbox="allow-scripts"` **without**
 * `allow-same-origin` (P1-Preview AC-1), so the document's origin is opaque.
 * That is why the parent never validates `event.origin` — see D-DS-4 and
 * `previewBridge.ts` in the renderer.
 */
export const STUDIO_SCHEME = 'hive-studio'

/** The one addressable host. See the module comment for why there is only one. */
export const STUDIO_PREVIEW_HOST = 'preview'

/**
 * The scheme registration passed to `protocol.registerSchemesAsPrivileged()`
 * **before** `app.whenReady()` — Chromium reads the scheme registry during
 * startup, so a later call silently does nothing.
 *
 * `bypassCSP` stays false: the whole point of the scheme is that its responses
 * carry their own CSP (`studioHeaders`), and a scheme that bypassed CSP would
 * disable the very control this phase exists to install.
 */
export const STUDIO_SCHEME_PRIVILEGES = {
  scheme: STUDIO_SCHEME,
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
 * Serving roots addressable by hostname. Only `preview` today; the index
 * signature is what makes an arbitrary (attacker-supplied) hostname safe to
 * look up — an unknown key yields `undefined` and the request is refused.
 */
export interface StudioProtocolRoots {
  preview: string
  [host: string]: string | undefined
}

/**
 * Resolves a `hive-studio://<host>/<path>` request to an absolute file path
 * inside a known root, or `null` when the host is unknown or the path escapes
 * its root.
 *
 * Pure and synchronous so the security boundary can be tested exhaustively
 * without Electron — including the encoded traversal shapes the URL parser
 * cannot see.
 */
export function resolveStudioRequest(roots: StudioProtocolRoots, url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${STUDIO_SCHEME}:`) return null

  const root = roots[parsed.hostname]
  if (!root) return null

  let rest: string
  try {
    rest = decodeURIComponent(parsed.pathname)
  } catch {
    return null // malformed percent-encoding
  }
  rest = rest.replace(/^\/+/, '')
  if (rest === '') return null
  // A decoded NUL would truncate the path at the syscall boundary, making the
  // string the guard below checks differ from the path actually opened.
  if (rest.includes('\0')) return null

  const full = join(root, rest)
  // Traversal is neutralized at two layers, and both matter:
  //   1. Literal `../` is resolved away by `new URL()` itself (a `standard`
  //      scheme normalizes the path at parse time), so it can never escape.
  //   2. Percent-encoded `%2e%2e%2f` is opaque to the parser and only becomes
  //      `../` after `decodeURIComponent` above — this explicit guard is what
  //      catches that shape.
  if (full !== root && !full.startsWith(root.endsWith(sep) ? root : root + sep)) return null
  return full
}
