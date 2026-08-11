import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createStudioProtocolHandler,
  resolveStudioRequest,
  STUDIO_CSP,
  STUDIO_PREVIEW_HOST,
  STUDIO_SCHEME,
  STUDIO_SCHEME_PRIVILEGES,
  studioResourcesRoot,
  type StudioProtocolRoots
} from './previewProtocol'
import { createPreviewSessions } from './previewSessions'

/**
 * design-studio T3.1. `resolveStudioRequest` is a security boundary: it is the
 * only thing between a URL the Preview document can construct and a file read
 * off the user's disk. So the path-escape cases are enumerated rather than
 * sampled — including the encoded shapes the URL parser normalizes away and
 * therefore *cannot* be the layer that catches.
 */

const roots: StudioProtocolRoots = { preview: join('/app', 'resources') }

const url = (path: string): string => `${STUDIO_SCHEME}://${STUDIO_PREVIEW_HOST}${path}`

/**
 * T7.8 — the packaged-only failure `npm run build:unpack` caught.
 *
 * `asarUnpack: resources/**` puts the DS bundle, the receiver and the catalog
 * at `<resourcesPath>/app.asar.unpacked/resources/`, not at
 * `<resourcesPath>/`. Rooting the scheme at `process.resourcesPath` therefore
 * 404s every asset in a packaged app and nowhere else — the one shape no test,
 * dev run or E2E against `out/` ever exercises.
 */
describe('studioResourcesRoot (T7.8)', () => {
  it('resolves beside the main bundle in dev', () => {
    expect(studioResourcesRoot(join('/repo', 'out', 'main'))).toBe(join('/repo', 'resources'))
  })

  it('resolves inside the asar when packaged, where the unpacked redirect lives', () => {
    // Electron's fs shim maps an unpacked entry under `app.asar/` to the real
    // file under `app.asar.unpacked/`, which is what `readFile` here relies on.
    expect(studioResourcesRoot(join('/app', 'resources', 'app.asar', 'out', 'main'))).toBe(
      join('/app', 'resources', 'app.asar', 'resources')
    )
  })

  it('never resolves to the resources path itself — the shape that shipped broken', () => {
    expect(studioResourcesRoot(join('/app', 'resources', 'app.asar', 'out', 'main'))).not.toBe(
      join('/app', 'resources')
    )
  })
})

describe('previewProtocol — scheme privileges', () => {
  it('registers the hive-studio scheme', () => {
    expect(STUDIO_SCHEME_PRIVILEGES.scheme).toBe('hive-studio')
    expect(STUDIO_SCHEME).toBe('hive-studio')
  })

  it('is a standard, secure, fetchable, streaming scheme', () => {
    const { privileges } = STUDIO_SCHEME_PRIVILEGES
    expect(privileges.standard).toBe(true)
    expect(privileges.secure).toBe(true)
    expect(privileges.supportFetchAPI).toBe(true)
    expect(privileges.stream).toBe(true)
  })

  it('does NOT bypass CSP — the response CSP is the control this phase installs', () => {
    expect(STUDIO_SCHEME_PRIVILEGES.privileges.bypassCSP).toBe(false)
  })

  it('is CORS-enabled, so the opaque-origin frame can fetch its own assets', () => {
    expect(STUDIO_SCHEME_PRIVILEGES.privileges.corsEnabled).toBe(true)
  })
})

describe('resolveStudioRequest — happy path', () => {
  it('resolves the DS bundle under the preview root', () => {
    expect(resolveStudioRequest(roots, url('/design-system-web-awesome/webawesome.js'))).toBe(
      join(roots.preview, 'design-system-web-awesome/webawesome.js')
    )
  })

  it('resolves the in-frame receiver under the same root, so both share one origin', () => {
    expect(resolveStudioRequest(roots, url('/design-studio-preview/receiver.js'))).toBe(
      join(roots.preview, 'design-studio-preview/receiver.js')
    )
  })

  it('percent-decodes the path', () => {
    expect(resolveStudioRequest(roots, url('/a%20b/c.css'))).toBe(join(roots.preview, 'a b/c.css'))
  })

  it('collapses repeated leading slashes rather than treating them as an authority', () => {
    expect(resolveStudioRequest(roots, url('///webawesome.css'))).toBe(
      join(roots.preview, 'webawesome.css')
    )
  })
})

describe('resolveStudioRequest — unknown host', () => {
  it('refuses a host that is not a declared root', () => {
    expect(resolveStudioRequest(roots, 'hive-studio://secrets/id_rsa')).toBeNull()
    expect(resolveStudioRequest(roots, 'hive-studio://ds/webawesome.js')).toBeNull()
    expect(resolveStudioRequest(roots, 'hive-studio://userdata/sessions.json')).toBeNull()
  })

  it('refuses an empty host', () => {
    expect(resolveStudioRequest(roots, 'hive-studio:///webawesome.js')).toBeNull()
  })

  it('refuses a host that only looks like the real one', () => {
    expect(resolveStudioRequest(roots, 'hive-studio://preview.evil.com/x.js')).toBeNull()
    expect(resolveStudioRequest(roots, 'hive-studio://xpreview/x.js')).toBeNull()
  })

  it('refuses another scheme even when the host is known', () => {
    expect(resolveStudioRequest(roots, 'file://preview/webawesome.js')).toBeNull()
    expect(resolveStudioRequest(roots, 'https://preview/webawesome.js')).toBeNull()
    expect(resolveStudioRequest(roots, 'hive-model://preview/webawesome.js')).toBeNull()
  })

  it('refuses a URL it cannot parse', () => {
    expect(resolveStudioRequest(roots, 'not a url')).toBeNull()
    expect(resolveStudioRequest(roots, '')).toBeNull()
  })

  it('refuses an empty path — a root directory is not a file', () => {
    expect(resolveStudioRequest(roots, 'hive-studio://preview')).toBeNull()
    expect(resolveStudioRequest(roots, 'hive-studio://preview/')).toBeNull()
  })
})

describe('resolveStudioRequest — path escape', () => {
  const escapes = [
    // Literal traversal: the URL parser normalizes it away at parse time, so
    // it never escapes — it just lands somewhere harmless inside the root.
    '/../../../etc/passwd',
    '/design-system-web-awesome/../../../../etc/shadow',
    '/..',
    '/../',
    // Encoded traversal: opaque to the parser, only becomes `../` after
    // decodeURIComponent — this is the shape the explicit guard exists for.
    '/%2e%2e/%2e%2e/etc/passwd',
    '/%2E%2E%2F%2E%2E%2Fetc/passwd',
    '/..%2f..%2fetc/passwd',
    '/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/a/%2e%2e/%2e%2e/%2e%2e/root/.ssh/id_rsa',
    // Double-encoded, in case a layer decodes twice.
    '/%252e%252e%252fetc%252fpasswd'
  ]

  // The invariant, stated once and applied to every shape: whatever comes
  // back is either refused or strictly inside the root. Which of the two
  // layers caught it is an implementation detail; that neither lets a byte out
  // of `resources/` is the property.
  for (const path of escapes) {
    it(`never resolves outside the root for ${path}`, () => {
      const resolved = resolveStudioRequest(roots, url(path))
      if (resolved === null) return
      expect(resolved.startsWith(roots.preview + '/')).toBe(true)
      expect(resolved).not.toContain(`..${'/'}`)
    })
  }

  // `%2e%2e` is a `..` segment to the URL parser itself, so those shapes are
  // normalized before the guard ever runs. `..%2f` is not — the segment is
  // `..%2f..%2fetc`, opaque until `decodeURIComponent`. That is exactly the
  // shape the explicit guard exists for, so it gets its own hard assertion.
  it('returns null for %2f-encoded separators, which the URL parser cannot normalize', () => {
    expect(resolveStudioRequest(roots, url('/..%2f..%2fetc/passwd'))).toBeNull()
    expect(resolveStudioRequest(roots, url('/%2e%2e%2f%2e%2e%2fetc%2fpasswd'))).toBeNull()
    expect(resolveStudioRequest(roots, url('/%2E%2E%2F%2E%2E%2Fetc/passwd'))).toBeNull()
  })

  it('returns null for a %2f-encoded escape of exactly one level', () => {
    expect(resolveStudioRequest(roots, url('/..%2fsibling.js'))).toBeNull()
  })

  it('normalizes %2e%2e away at parse time, keeping the request inside the root', () => {
    expect(resolveStudioRequest(roots, url('/%2e%2e/%2e%2e/etc/passwd'))).toBe(
      join(roots.preview, 'etc/passwd')
    )
    expect(resolveStudioRequest(roots, url('/%2e%2e/sibling.js'))).toBe(
      join(roots.preview, 'sibling.js')
    )
  })

  it('refuses a backslash traversal (a real escape on win32, a literal name elsewhere)', () => {
    const resolved = resolveStudioRequest(roots, url('/%2e%2e%5c%2e%2e%5cetc%5cpasswd'))
    if (resolved !== null) {
      expect(resolved.startsWith(roots.preview + '/')).toBe(true)
    }
  })

  it('treats an absolute POSIX path smuggled in as the pathname as root-relative', () => {
    // `//etc/passwd` would be an authority; the leading-slash strip makes it a
    // relative path under the root instead of an absolute one.
    expect(resolveStudioRequest(roots, 'hive-studio://preview//etc/passwd')).toBe(
      join(roots.preview, 'etc/passwd')
    )
  })

  it('refuses malformed percent-encoding instead of throwing', () => {
    expect(resolveStudioRequest(roots, url('/%'))).toBeNull()
    expect(resolveStudioRequest(roots, url('/%zz'))).toBeNull()
    expect(resolveStudioRequest(roots, url('/a/%E0%A4%A'))).toBeNull()
  })

  it('refuses an encoded NUL, which would truncate the path at the syscall', () => {
    expect(resolveStudioRequest(roots, url('/webawesome.js%00.txt'))).toBeNull()
  })

  it('refuses a sibling directory whose name merely starts with the root string', () => {
    const narrow: StudioProtocolRoots = { preview: '/app/res' }
    // `/app/res-evil/x.js` starts with `/app/res` as a *string* but is a
    // different directory — a prefix check without the separator would pass it.
    expect(resolveStudioRequest(narrow, url('/..%2fres-evil%2fx.js'))).toBeNull()
  })

  it('accepts the root itself as a trailing-separator root without a false negative', () => {
    const trailing: StudioProtocolRoots = { preview: '/app/resources/' }
    expect(resolveStudioRequest(trailing, url('/webawesome.css'))).toBe(
      join('/app/resources', 'webawesome.css')
    )
  })
})

describe('createStudioProtocolHandler — the response CSP (P1-Preview AC-2, D-DS-4)', () => {
  let dir: string
  let handle: (request: { url: string }) => Promise<Response>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hive-studio-'))
    mkdirSync(join(dir, 'design-system-web-awesome'), { recursive: true })
    writeFileSync(join(dir, 'design-system-web-awesome', 'webawesome.js'), 'export const a = 1')
    writeFileSync(join(dir, 'design-system-web-awesome', 'webawesome.css'), ':root{}')
    handle = createStudioProtocolHandler({ preview: dir })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  // Every assertion below reads the header off the emitted `Response`. None of
  // them reads the source that built it.
  it('emits connect-src data: — NOT none, which would kill every wa-icon in silence', async () => {
    const response = await handle({ url: url('/design-system-web-awesome/webawesome.js') })
    const csp = response.headers.get('content-security-policy') ?? ''
    expect(csp).toContain('connect-src data:')
    expect(csp).not.toContain("connect-src 'none'")
  })

  it('emits script-src self, so only same-origin scripts run in the frame', async () => {
    const response = await handle({ url: url('/design-system-web-awesome/webawesome.js') })
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self'")
  })

  it('emits style-src self plus unsafe-inline, which the DS needs for its styles', async () => {
    const response = await handle({ url: url('/design-system-web-awesome/webawesome.css') })
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'self' 'unsafe-inline'"
    )
  })

  it('emits img-src self and data:, so inlined icons render and remote ones cannot', async () => {
    const response = await handle({ url: url('/design-system-web-awesome/webawesome.js') })
    const csp = response.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("img-src 'self' data:")
    expect(csp).not.toContain('https:')
    expect(csp).not.toContain('*')
  })

  it('carries the CSP on every response, not only on the document', async () => {
    const js = await handle({ url: url('/design-system-web-awesome/webawesome.js') })
    const css = await handle({ url: url('/design-system-web-awesome/webawesome.css') })
    expect(js.headers.get('content-security-policy')).toBe(STUDIO_CSP)
    expect(css.headers.get('content-security-policy')).toBe(STUDIO_CSP)
  })
})

describe('createStudioProtocolHandler — serving', () => {
  let dir: string
  let handle: (request: { url: string }) => Promise<Response>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hive-studio-'))
    writeFileSync(join(dir, 'webawesome.js'), 'export const a = 1')
    writeFileSync(join(dir, 'webawesome.css'), ':root{}')
    writeFileSync(join(dir, 'notes'), 'no extension')
    handle = createStudioProtocolHandler({ preview: dir })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves the file bytes with 200', async () => {
    const response = await handle({ url: url('/webawesome.js') })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('export const a = 1')
  })

  it('types JavaScript and CSS so the frame executes and applies them', async () => {
    expect((await handle({ url: url('/webawesome.js') })).headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8'
    )
    expect((await handle({ url: url('/webawesome.css') })).headers.get('content-type')).toBe(
      'text/css; charset=utf-8'
    )
  })

  it('falls back to octet-stream for an unknown extension', async () => {
    expect((await handle({ url: url('/notes') })).headers.get('content-type')).toBe(
      'application/octet-stream'
    )
  })

  it('never caches, so an edit is never masked by a stale response', async () => {
    expect((await handle({ url: url('/webawesome.js') })).headers.get('cache-control')).toBe(
      'no-store'
    )
  })

  it('answers 404 for a refused request rather than leaking why', async () => {
    expect((await handle({ url: 'hive-studio://secrets/id_rsa' })).status).toBe(404)
    expect((await handle({ url: url('/..%2f..%2fetc/passwd') })).status).toBe(404)
  })

  it('answers 404 for a resolvable path that is not a readable file', async () => {
    expect((await handle({ url: url('/missing.js') })).status).toBe(404)
  })
})

describe('createStudioProtocolHandler — the session shell', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hive-studio-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves the generated shell for a live session, as an HTML document', async () => {
    const sessions = createPreviewSessions()
    const handle = createStudioProtocolHandler({ preview: dir }, sessions.shellFor)
    const response = await handle({ url: sessions.url(sessions.open()) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await response.text()).toContain('<!doctype html>')
  })

  it('carries the same CSP on the document as on every asset', async () => {
    const sessions = createPreviewSessions()
    const handle = createStudioProtocolHandler({ preview: dir }, sessions.shellFor)
    const response = await handle({ url: sessions.url(sessions.open()) })
    expect(response.headers.get('content-security-policy')).toBe(STUDIO_CSP)
  })

  it('404s a shell URL whose session is not live, rather than reading it off disk', async () => {
    const sessions = createPreviewSessions()
    const handle = createStudioProtocolHandler({ preview: dir }, sessions.shellFor)
    const token = sessions.open()
    sessions.close(token)
    expect((await handle({ url: sessions.url(token) })).status).toBe(404)
  })

  it('serves no shell at all when no resolver is composed in', async () => {
    const sessions = createPreviewSessions()
    const handle = createStudioProtocolHandler({ preview: dir })
    expect((await handle({ url: sessions.url(sessions.open()) })).status).toBe(404)
  })
})
