import { readFile } from 'fs/promises'
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

/**
 * Where the Studio's shipped artifacts live, resolved **from the main bundle**
 * rather than from `process.resourcesPath`.
 *
 * This looks like a detail and is a release blocker. `electron-builder.yml`
 * carries `asarUnpack: resources/**`, and an unpacked entry does not land at
 * `<resourcesPath>/resources/…` — it lands at
 * `<resourcesPath>/app.asar.unpacked/resources/…`, while `process.resourcesPath`
 * points at `<resourcesPath>`. Reading through it would 404 the DS bundle, the
 * receiver and the catalog in a packaged app, and *only* in a packaged app —
 * every test, every dev run and every E2E against `out/` would stay green
 * (measured with `npm run build:unpack`, T7.8).
 *
 * A path relative to the main bundle is right in both shapes: in dev
 * `out/main/` sits beside `resources/`, and packaged it resolves inside the
 * asar, where Electron's own fs shim redirects unpacked entries to
 * `app.asar.unpacked/` — which is exactly what `readFile` here relies on.
 */
export function studioResourcesRoot(mainDir: string): string {
  return join(mainDir, '..', '..', 'resources')
}

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

/**
 * The Content-Security-Policy every response under this scheme carries
 * (P1-Preview AC-2). The iframe is already `sandbox="allow-scripts"` without
 * `allow-same-origin`; this is the second, independent layer.
 *
 * `connect-src data:` — **not `'none'`**, and this is the one place the letter
 * of the spec was changed on purpose (D-DS-4, D32). Phase 2 measured that
 * `wa-icon` resolves *every* icon through `fetch(url, { mode: 'cors' })`
 * (`chunk.ZCZ2WKQR.js:62`), including the `data:` URLs our own local icon
 * library returns — and `connect-src` governs `fetch` even for `data:`. Under
 * `'none'` every icon would vanish, silently, in the Preview and in the
 * exported Bundle. The network egress is still zero: a `data:` URL reaches no
 * server. What changed is the wording of the AC, not the security property,
 * and T3.8 is what keeps that honest by observing the frame's real traffic.
 *
 * `script-src 'self'` is why there is a single host (see the module comment)
 * and why the shell carries no inline script: the receiver reads its session
 * token off `location`, so nothing has to be interpolated into markup.
 */
export const STUDIO_CSP = [
  'connect-src data:',
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:"
].join('; ')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
}

/**
 * Headers for one Preview response. Pure (a filename in, headers out) so the
 * CSP contract is asserted against real emitted headers without Electron.
 *
 * The CSP rides on *every* response, not only the document: a subresource
 * cannot be navigated to inside the sandbox, but a scheme whose policy depends
 * on which file was asked for is a policy with a hole in it.
 */
export function studioHeaders(file: string): Record<string, string> {
  const dot = file.lastIndexOf('.')
  const extension = dot === -1 ? '' : file.slice(dot).toLowerCase()
  return {
    'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'content-security-policy': STUDIO_CSP,
    // The Preview must reflect the document as of this instant; a cached shell
    // or a stale bundle would make an edit look like it did not apply.
    'cache-control': 'no-store'
  }
}

/**
 * Answers a request with a generated session shell, or `null` to let the
 * request fall through to the file root. Supplied by `previewSessions.ts`.
 */
export type StudioShellResolver = (url: string) => string | null

/**
 * Builds the `protocol.handle(STUDIO_SCHEME, …)` handler.
 *
 * Files are read with `fs/promises` rather than `net.fetch(file://…)` (the
 * whisper mold) for one reason: it keeps the handler free of Electron, so the
 * emitted headers — the actual `Response`, not the source that builds it — can
 * be asserted in a unit test.
 */
export function createStudioProtocolHandler(
  roots: StudioProtocolRoots,
  shell: StudioShellResolver = () => null
): (request: { url: string }) => Promise<Response> {
  return async (request) => {
    // The session shell is generated, not read off disk, so it is routed
    // first. `shell` is injected rather than imported: it keeps this module
    // about the protocol, and it is what makes "a URL for a session that was
    // never opened resolves to nothing" a property of the composition instead
    // of a special case buried in here.
    const document = shell(request.url)
    if (document !== null) {
      return new Response(document, { status: 200, headers: studioHeaders('index.html') })
    }

    const file = resolveStudioRequest(roots, request.url)
    if (!file) return new Response(null, { status: 404 })
    let body: Buffer
    try {
      body = await readFile(file)
    } catch {
      return new Response(null, { status: 404 })
    }
    return new Response(new Uint8Array(body), { status: 200, headers: studioHeaders(file) })
  }
}
