import { describe, expect, it, vi } from 'vitest'
import type { RegistryClient } from './npmRegistry'
import { fetchLatestRelease, isNewer, platformKey } from './npmRegistry'

/** A `RegistryClient` whose `fetchJson` always resolves to `response`. */
function fakeClient(response: unknown): RegistryClient {
  return { fetchJson: vi.fn().mockResolvedValue(response) }
}

/** A `RegistryClient` whose `fetchJson` always rejects with `error`. */
function failingClient(error: unknown): RegistryClient {
  return { fetchJson: vi.fn().mockRejectedValue(error) }
}

describe('platformKey', () => {
  it('joins platform and arch with a dash', () => {
    expect(platformKey('win32', 'x64')).toBe('win32-x64')
    expect(platformKey('darwin', 'arm64')).toBe('darwin-arm64')
  })
})

describe('isNewer', () => {
  it('true when candidate is a newer release', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true)
  })

  it('false when candidate is an older release', () => {
    expect(isNewer('0.1.0', '0.2.0')).toBe(false)
  })

  it('false when candidate equals current', () => {
    expect(isNewer('0.2.0', '0.2.0')).toBe(false)
  })

  it('correctly orders by semver precedence, not string comparison', () => {
    // A naive string compare would say "0.9.0" > "0.10.0" (lexical '9' > '1').
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('0.9.0', '0.10.0')).toBe(false)
  })

  it('a prerelease is not newer than its own release version', () => {
    expect(isNewer('1.0.0-beta.1', '1.0.0')).toBe(false)
  })

  it('a prerelease of the next version is newer than the current release', () => {
    expect(isNewer('1.1.0-beta.1', '1.0.0')).toBe(true)
  })

  it('degrades to false (never throws) when either side is not valid semver', () => {
    expect(isNewer('not-a-version', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', 'not-a-version')).toBe(false)
    expect(isNewer('garbage', 'garbage')).toBe(false)
  })
})

describe('fetchLatestRelease', () => {
  const PKG = '@user/hive-desktop'

  it('requests the /latest doc for the (encoded) package name', async () => {
    const client = fakeClient({ version: '0.2.0' })
    await fetchLatestRelease(client, PKG)
    expect(client.fetchJson).toHaveBeenCalledWith(
      'https://registry.npmjs.org/@user%2Fhive-desktop/latest'
    )
  })

  it('reads version, notes, repo and the platform asset for this platform+arch', async () => {
    const key = platformKey(process.platform, process.arch)
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: {
        notes: '### Novidades\n- coisas',
        repo: 'gustavobrunodev/hive',
        platforms: { [key]: 'hive-desktop-0.2.0-setup.exe' }
      }
    })

    const result = await fetchLatestRelease(client, PKG)

    expect(result).toEqual({
      version: '0.2.0',
      notes: '### Novidades\n- coisas',
      repo: 'gustavobrunodev/hive',
      platformAsset: 'hive-desktop-0.2.0-setup.exe'
    })
  })

  it('platformAsset and repo are null when hiveRelease is entirely missing', async () => {
    const client = fakeClient({ version: '0.2.0' })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, repo: null, platformAsset: null })
  })

  it('platformAsset is null when this platform has no entry, independent of repo', async () => {
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: {
        notes: 'x',
        repo: 'gustavobrunodev/hive',
        platforms: { 'some-other-platform': 'hive-desktop-0.2.0-setup.exe' }
      }
    })
    const result = await fetchLatestRelease(client, PKG)
    expect(result.platformAsset).toBeNull()
    expect(result.repo).toBe('gustavobrunodev/hive')
    expect(result.notes).toBe('x')
  })

  it('repo is null when hiveRelease has no usable repo field', async () => {
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: { notes: 'x', platforms: {} }
    })
    const result = await fetchLatestRelease(client, PKG)
    expect(result.repo).toBeNull()
  })

  it('degrades to no-release when hiveRelease is malformed (wrong types)', async () => {
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: { notes: 42, repo: 7, platforms: 'not-an-object' }
    })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, repo: null, platformAsset: null })
  })

  it('degrades to no-release when hiveRelease itself is not an object', async () => {
    const client = fakeClient({ version: '0.2.0', hiveRelease: 'not-an-object' })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, repo: null, platformAsset: null })
  })

  it('degrades to the sentinel version when the response has no usable "version"', async () => {
    const client = fakeClient({ hiveRelease: { notes: 'x' } })
    const result = await fetchLatestRelease(client, PKG)
    expect(result.version).toBe('0.0.0')
  })

  it('degrades to no-release on a malformed (non-object) JSON payload', async () => {
    const client = fakeClient('just a string, not the expected object')
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, repo: null, platformAsset: null })
  })

  it('degrades to no-release on null JSON payload', async () => {
    const client = fakeClient(null)
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, repo: null, platformAsset: null })
  })

  it('degrades to no-release when fetchJson rejects (404/500-style)', async () => {
    const client = failingClient(new Error('Not Found'))
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, repo: null, platformAsset: null })
  })

  it('degrades to no-release when fetchJson rejects with a timeout-style error', async () => {
    const client = failingClient(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, repo: null, platformAsset: null })
  })

  it('never rejects, even when fetchJson rejects', async () => {
    const client = failingClient(new Error('boom'))
    await expect(fetchLatestRelease(client, PKG)).resolves.toBeDefined()
  })
})
