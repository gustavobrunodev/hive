import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'
import {
  readSsoToken,
  ssoCacheDir,
  ssoCacheFileName,
  tokenState,
  SSO_REFRESH_MARGIN_MS,
  SSO_WARN_WINDOW_MS,
  type SsoCacheDeps,
  type SsoTokenInfo
} from './awsSsoCache'

const HOME = '/home/u'
const NOW = Date.parse('2026-09-04T12:00:00Z')

/** The exact shape AWS CLI 2.32 writes — including the fields we never read. */
function tokenFile(
  expiresAt: string,
  startUrl = 'https://acme.awsapps.com/start'
): Record<string, string> {
  return {
    startUrl,
    region: 'us-east-1',
    accessToken: 'aoa-redacted',
    expiresAt,
    clientId: 'wGb1jlQaf2GG1K4oFYnS13VzLWVhc3QtMQ',
    clientSecret: 'secret',
    refreshToken: 'refresh'
  }
}

function deps(files: Record<string, unknown>, extra: Partial<SsoCacheDeps> = {}): SsoCacheDeps {
  return {
    home: HOME,
    now: () => NOW,
    readJson: <T>(path: string) => (files[path] as T) ?? null,
    listDir: () => Object.keys(files).map((path) => path.split('/').pop() as string),
    ...extra
  }
}

const cachePath = (key: string): string => `${ssoCacheDir({ home: HOME })}/${ssoCacheFileName(key)}`

describe('ssoCacheFileName', () => {
  it('is the SHA-1 of the key, which is how the AWS CLI names the file', () => {
    // Measured on a real machine: sha1('fitame') names the token of the
    // sso-session called `fitame`.
    expect(ssoCacheFileName('fitame')).toBe('02b39a17e5021fc8db6bc4c0aa19b1cc5bf524d3.json')
    expect(ssoCacheFileName('acme')).toBe(`${createHash('sha1').update('acme').digest('hex')}.json`)
  })
})

describe('readSsoToken', () => {
  it('reads the token whose filename hashes the session name', () => {
    const token = readSsoToken(
      'acme',
      deps({ [cachePath('acme')]: tokenFile('2026-09-04T20:00:00Z') })
    )
    expect(token?.expiresAt).toBe('2026-09-04T20:00:00Z')
    expect(token?.expiresInMs).toBe(8 * 60 * 60 * 1000)
    expect(token?.startUrl).toBe('https://acme.awsapps.com/start')
  })

  it('never returns the secrets it read past', () => {
    const token = readSsoToken(
      'acme',
      deps({ [cachePath('acme')]: tokenFile('2026-09-04T20:00:00Z') })
    )
    expect(JSON.stringify(token)).not.toContain('redacted')
    expect(JSON.stringify(token)).not.toContain('refresh')
  })

  it('answers null for a key with no cache file', () => {
    expect(readSsoToken('acme', deps({}))).toBeNull()
  })

  it('answers null for no key at all', () => {
    expect(readSsoToken(null, deps({}))).toBeNull()
  })

  it('skips the client-registration file, which has an expiry but no token', () => {
    const registration = { clientId: 'c', clientSecret: 's', expiresAt: '2026-12-01T00:00:00Z' }
    expect(readSsoToken('acme', deps({ [cachePath('acme')]: registration }))).toBeNull()
  })

  it('answers null for a file with an unparseable expiry', () => {
    const broken = { ...tokenFile('2026-09-04T20:00:00Z'), expiresAt: 'soon' }
    expect(readSsoToken('acme', deps({ [cachePath('acme')]: broken }))).toBeNull()
  })

  it('finds a start-URL key cached under some other name, by scanning for the URL', () => {
    // The migrated setup: the profile names a session, but the token on disk
    // was written under the legacy start-URL form. Reporting "logged out" to
    // someone who is logged in is the worst answer this module can give.
    const url = 'https://acme.awsapps.com/start'
    const token = readSsoToken(
      url,
      deps({ [cachePath('some-other-name')]: tokenFile('2026-09-04T20:00:00Z', url) })
    )
    expect(token?.startUrl).toBe(url)
  })

  it('does not scan for a non-URL key — a session name has exactly one filename', () => {
    const token = readSsoToken(
      'acme',
      deps({ [cachePath('other')]: tokenFile('2026-09-04T20:00:00Z') })
    )
    expect(token).toBeNull()
  })

  it('ignores a scanned file whose start URL is a different portal', () => {
    const token = readSsoToken(
      'https://acme.awsapps.com/start',
      deps({
        [cachePath('x')]: tokenFile('2026-09-04T20:00:00Z', 'https://other.awsapps.com/start')
      })
    )
    expect(token).toBeNull()
  })

  it('survives an unreadable cache directory', () => {
    const token = readSsoToken('https://acme.awsapps.com/start', {
      home: HOME,
      now: () => NOW,
      readJson: () => null,
      listDir: () => {
        throw new Error('EACCES')
      }
    })
    expect(token).toBeNull()
  })

  it('ignores non-JSON entries while scanning', () => {
    const token = readSsoToken('https://acme.awsapps.com/start', {
      home: HOME,
      now: () => NOW,
      readJson: () => null,
      listDir: () => ['README', 'nope.txt']
    })
    expect(token).toBeNull()
  })
})

describe('tokenState', () => {
  const at = (expiresInMs: number): SsoTokenInfo => ({
    startUrl: null,
    region: null,
    expiresAt: 'x',
    expiresInMs,
    path: 'p'
  })

  it('is absent with no token', () => {
    expect(tokenState(null)).toBe('absent')
  })

  it('is valid comfortably ahead of expiry', () => {
    expect(tokenState(at(6 * 60 * 60 * 1000))).toBe('valid')
  })

  it('warns inside the half-hour window', () => {
    expect(tokenState(at(SSO_WARN_WINDOW_MS - 1))).toBe('expiring')
  })

  it('counts as expired inside the refresh margin, before the clock actually runs out', () => {
    // The point of the margin: a token good for another ninety seconds dies
    // mid-turn, and a turn that dies halfway has already spent the user's time.
    expect(tokenState(at(SSO_REFRESH_MARGIN_MS - 1))).toBe('expired')
    expect(tokenState(at(-1))).toBe('expired')
  })
})
