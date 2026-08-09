import { describe, expect, it } from 'vitest'
import { join } from 'path'
import {
  resolveStudioRequest,
  STUDIO_PREVIEW_HOST,
  STUDIO_SCHEME,
  STUDIO_SCHEME_PRIVILEGES,
  type StudioProtocolRoots
} from './previewProtocol'

/**
 * design-studio T3.1. `resolveStudioRequest` is a security boundary: it is the
 * only thing between a URL the Preview document can construct and a file read
 * off the user's disk. So the path-escape cases are enumerated rather than
 * sampled — including the encoded shapes the URL parser normalizes away and
 * therefore *cannot* be the layer that catches.
 */

const roots: StudioProtocolRoots = { preview: join('/app', 'resources') }

const url = (path: string): string => `${STUDIO_SCHEME}://${STUDIO_PREVIEW_HOST}${path}`

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
    expect(resolveStudioRequest(roots, url('/a%20b/c.css'))).toBe(
      join(roots.preview, 'a b/c.css')
    )
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
