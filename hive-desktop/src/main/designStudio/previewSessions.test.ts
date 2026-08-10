import { describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import { createStudioSessionStore } from './sessionStore'
import {
  createPreviewSessions,
  renderPreviewShell,
  shellTokenOf,
  DS_BUNDLE_PATH,
  RECEIVER_PATH
} from './previewSessions'

/**
 * design-studio T3.3 (AD-7, P1-Preview AC-6).
 *
 * The property under test is *unguessability*, and it is easy to fake: a token
 * derived from `(specPathHash, workspaceHash)` looks random, is stable across
 * reopens (which feels like a feature), and is fully reconstructible by anyone
 * who knows the Spec's path. So the tests assert both halves — that the token
 * is not that derivation, and that two opens never agree.
 */

const store = createStudioSessionStore('/tmp/unused')
const SPEC = '/home/u/workspace/docs/ux-spec.md'
const WORKSPACE = '/home/u/workspace'

describe('preview session token', () => {
  it('is 32 bytes of hex — long enough that guessing is not a strategy', () => {
    const token = createPreviewSessions().open()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs between two open() calls on the same session', () => {
    const sessions = createPreviewSessions()
    expect(sessions.open()).not.toBe(sessions.open())
  })

  it('differs across 200 opens — no counter, no reuse', () => {
    const sessions = createPreviewSessions()
    const tokens = new Set(Array.from({ length: 200 }, () => sessions.open()))
    expect(tokens.size).toBe(200)
  })

  it('is NOT derived from the (specPathHash, workspaceHash) disk key', () => {
    const diskKey = store.key(SPEC, WORKSPACE)
    const token = createPreviewSessions().open()

    // The disk key itself, and every obvious derivation of it, must not be the
    // token — that is what makes the URL unguessable to someone who knows the
    // Spec's path (which the workspace tree already tells them).
    const derivations = [
      diskKey,
      diskKey.replace('-', ''),
      createHash('sha256').update(diskKey).digest('hex'),
      createHash('sha256').update(`${SPEC}${WORKSPACE}`).digest('hex'),
      createHash('sha256').update(SPEC).digest('hex')
    ]
    for (const derivation of derivations) expect(token).not.toBe(derivation)
  })

  it('keeps the disk key deterministic — the two identifiers stay distinct', () => {
    // The other half of the same invariant: reopening the same Spec must find
    // the same session on disk, so the disk key must NOT become random.
    expect(store.key(SPEC, WORKSPACE)).toBe(store.key(SPEC, WORKSPACE))
    expect(store.key(SPEC, WORKSPACE)).not.toBe(store.key(SPEC, '/other/workspace'))
  })
})

describe('preview session URL', () => {
  it('points the iframe at the hive-studio: shell for that token', () => {
    const sessions = createPreviewSessions(() => 'a'.repeat(64))
    expect(sessions.url(sessions.open())).toBe(`hive-studio://preview/${'a'.repeat(64)}/index.html`)
  })

  it('resolves the shell only while the session is live', () => {
    const sessions = createPreviewSessions()
    const token = sessions.open()
    expect(sessions.has(token)).toBe(true)
    expect(sessions.shellFor(sessions.url(token))).toContain('<!doctype html>')

    sessions.close(token)
    expect(sessions.has(token)).toBe(false)
    expect(sessions.shellFor(sessions.url(token))).toBeNull()
  })

  it('refuses a well-formed token that was never opened', () => {
    const sessions = createPreviewSessions()
    sessions.open()
    expect(sessions.shellFor(`hive-studio://preview/${'b'.repeat(64)}/index.html`)).toBeNull()
  })
})

describe('shellTokenOf', () => {
  const token = 'c'.repeat(64)

  it('reads the token out of a shell URL', () => {
    expect(shellTokenOf(`hive-studio://preview/${token}/index.html`)).toBe(token)
  })

  it('is not a shell URL for an asset path', () => {
    expect(shellTokenOf(`hive-studio://preview${DS_BUNDLE_PATH}/webawesome.js`)).toBeNull()
    expect(shellTokenOf(`hive-studio://preview/${token}/webawesome.js`)).toBeNull()
    expect(shellTokenOf(`hive-studio://preview/${token}/sub/index.html`)).toBeNull()
  })

  it('rejects a token-shaped segment that is not a token', () => {
    expect(shellTokenOf('hive-studio://preview/short/index.html')).toBeNull()
    expect(shellTokenOf(`hive-studio://preview/${'Z'.repeat(64)}/index.html`)).toBeNull()
    expect(shellTokenOf(`hive-studio://preview/${'c'.repeat(63)}/index.html`)).toBeNull()
  })

  it('rejects another scheme or host, so nothing else can mint a shell', () => {
    expect(shellTokenOf(`https://preview/${token}/index.html`)).toBeNull()
    expect(shellTokenOf(`hive-studio://evil/${token}/index.html`)).toBeNull()
    expect(shellTokenOf('not a url')).toBeNull()
  })
})

describe('renderPreviewShell', () => {
  const shell = renderPreviewShell()

  it('loads the DS bundle and the receiver from root-absolute, same-origin paths', () => {
    // Relative URLs would resolve under `/<token>/`, a directory that does not
    // exist — the Preview would come up blank with two 404s.
    expect(shell).toContain(`src="${DS_BUNDLE_PATH}/webawesome.js"`)
    expect(shell).toContain(`href="${DS_BUNDLE_PATH}/webawesome.css"`)
    expect(shell).toContain(`src="${RECEIVER_PATH}/receiver.js"`)
    expect(shell).not.toContain('src="./')
    expect(shell).not.toContain('http://')
    expect(shell).not.toContain('https://')
  })

  it('carries no inline script — the token is never interpolated into markup', () => {
    // `script-src 'self'` would need a hash or nonce for an inline script, and
    // every way of getting one there ends in writing the token into the
    // document. The receiver reads it off `location` instead.
    expect(shell).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/)
  })

  it('does not embed the token, so the document is identical for every session', () => {
    const sessions = createPreviewSessions()
    const first = sessions.open()
    const second = sessions.open()
    expect(sessions.shellFor(sessions.url(first))).toBe(sessions.shellFor(sessions.url(second)))
    expect(shell).not.toContain(first)
  })
})
