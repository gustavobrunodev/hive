import { describe, expect, it, vi } from 'vitest'
import type { RegistryClient } from './npmRegistry'
import { fetchLatestRelease, fetchPayload, isNewer, platformKey } from './npmRegistry'

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

  it('reads version, notes and the platform package for this platform+arch', async () => {
    const key = platformKey(process.platform, process.arch)
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: {
        notes: '### Novidades\n- coisas',
        platforms: { [key]: '@user/hive-desktop-win-x64' }
      }
    })

    const result = await fetchLatestRelease(client, PKG)

    expect(result).toEqual({
      version: '0.2.0',
      notes: '### Novidades\n- coisas',
      platformPackage: '@user/hive-desktop-win-x64'
    })
  })

  it('platformPackage is null when hiveRelease is entirely missing', async () => {
    const client = fakeClient({ version: '0.2.0' })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, platformPackage: null })
  })

  it('platformPackage is null when this platform has no entry', async () => {
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: { notes: 'x', platforms: { 'some-other-platform': '@user/pkg' } }
    })
    const result = await fetchLatestRelease(client, PKG)
    expect(result.platformPackage).toBeNull()
    expect(result.notes).toBe('x')
  })

  it('degrades to no-release when hiveRelease is malformed (wrong types)', async () => {
    const client = fakeClient({
      version: '0.2.0',
      hiveRelease: { notes: 42, platforms: 'not-an-object' }
    })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, platformPackage: null })
  })

  it('degrades to no-release when hiveRelease itself is not an object', async () => {
    const client = fakeClient({ version: '0.2.0', hiveRelease: 'not-an-object' })
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.2.0', notes: null, platformPackage: null })
  })

  it('degrades to the sentinel version when the response has no usable "version"', async () => {
    const client = fakeClient({ hiveRelease: { notes: 'x' } })
    const result = await fetchLatestRelease(client, PKG)
    expect(result.version).toBe('0.0.0')
  })

  it('degrades to no-release on a malformed (non-object) JSON payload', async () => {
    const client = fakeClient('just a string, not the expected object')
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, platformPackage: null })
  })

  it('degrades to no-release on null JSON payload', async () => {
    const client = fakeClient(null)
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, platformPackage: null })
  })

  it('degrades to no-release when fetchJson rejects (404/500-style)', async () => {
    const client = failingClient(new Error('Not Found'))
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, platformPackage: null })
  })

  it('degrades to no-release when fetchJson rejects with a timeout-style error', async () => {
    const client = failingClient(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    const result = await fetchLatestRelease(client, PKG)
    expect(result).toEqual({ version: '0.0.0', notes: null, platformPackage: null })
  })

  it('never rejects, even when fetchJson rejects', async () => {
    const client = failingClient(new Error('boom'))
    await expect(fetchLatestRelease(client, PKG)).resolves.toBeDefined()
  })
})

describe('fetchPayload', () => {
  const PKG = '@user/hive-desktop-win-x64'

  it('requests /<pkg>/<version> for the encoded package name and version', async () => {
    const client = fakeClient({
      dist: { tarball: 'https://registry.npmjs.org/x/-/x-0.2.0.tgz', integrity: 'sha512-abc' }
    })
    await fetchPayload(client, PKG, '0.2.0')
    expect(client.fetchJson).toHaveBeenCalledWith(
      'https://registry.npmjs.org/@user%2Fhive-desktop-win-x64/0.2.0'
    )
  })

  it('reads tarball, integrity and byte size from dist', async () => {
    const client = fakeClient({
      dist: {
        tarball: 'https://registry.npmjs.org/x/-/x-0.2.0.tgz',
        integrity: 'sha512-abc123',
        unpackedSize: 96123456
      }
    })
    const result = await fetchPayload(client, PKG, '0.2.0')
    expect(result).toEqual({
      tarballUrl: 'https://registry.npmjs.org/x/-/x-0.2.0.tgz',
      integrity: 'sha512-abc123',
      bytes: 96123456
    })
  })

  it('bytes is null when dist has no unpackedSize', async () => {
    const client = fakeClient({
      dist: { tarball: 'https://registry.npmjs.org/x/-/x-0.2.0.tgz', integrity: 'sha512-abc' }
    })
    const result = await fetchPayload(client, PKG, '0.2.0')
    expect(result.bytes).toBeNull()
  })

  it('rejects when fetchJson rejects (propagated as a network-style failure)', async () => {
    const client = failingClient(new Error('ECONNRESET'))
    await expect(fetchPayload(client, PKG, '0.2.0')).rejects.toThrow('ECONNRESET')
  })

  it('rejects when the response has no dist object at all', async () => {
    const client = fakeClient({ version: '0.2.0' })
    await expect(fetchPayload(client, PKG, '0.2.0')).rejects.toThrow(/dist/)
  })

  it('rejects when dist.tarball is missing', async () => {
    const client = fakeClient({ dist: { integrity: 'sha512-abc' } })
    await expect(fetchPayload(client, PKG, '0.2.0')).rejects.toThrow(/dist.tarball/)
  })

  it('rejects when dist.integrity is missing', async () => {
    const client = fakeClient({ dist: { tarball: 'https://x/y.tgz' } })
    await expect(fetchPayload(client, PKG, '0.2.0')).rejects.toThrow(/dist.integrity/)
  })
})
