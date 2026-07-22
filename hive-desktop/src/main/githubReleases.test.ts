import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import type { GithubClient } from './githubReleases'
import { fetchGithubPayload } from './githubReleases'

const REPO = 'gustavobrunodev/hive'
const TAG = 'v0.2.0'
const ASSET_NAME = 'hive-desktop-0.2.0-setup.exe'
const MANIFEST_URL =
  'https://github.com/gustavobrunodev/hive/releases/download/v0.2.0/hive-update.json'
const INSTALLER_URL =
  'https://github.com/gustavobrunodev/hive/releases/download/v0.2.0/hive-desktop-0.2.0-setup.exe'

function sha512Base64(content: string): string {
  return createHash('sha512').update(content).digest('base64')
}

const SHA512 = sha512Base64('fake-installer-bytes')

function releaseJson(overrides: Record<string, unknown> = {}): unknown {
  return {
    tag_name: TAG,
    assets: [
      { name: ASSET_NAME, browser_download_url: INSTALLER_URL, size: 96123456 },
      { name: 'hive-update.json', browser_download_url: MANIFEST_URL, size: 512 }
    ],
    ...overrides
  }
}

function manifestJson(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: '0.2.0',
    platform: 'win32',
    arch: 'x64',
    installer: ASSET_NAME,
    bytes: 96123456,
    sha512: SHA512,
    ...overrides
  }
}

/** A `GithubClient` that dispatches by URL: the release-lookup URL returns `release`, anything else (the manifest's `browser_download_url`) returns `manifest`. */
function fakeClient(release: unknown, manifest: unknown): GithubClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async fetchJson(url: string): Promise<unknown> {
      calls.push(url)
      if (url.includes('/repos/')) return release
      return manifest
    }
  }
}

function failingClient(error: unknown): GithubClient {
  return { fetchJson: vi.fn().mockRejectedValue(error) }
}

describe('fetchGithubPayload', () => {
  it('requests the release-by-tag endpoint with an encoded repo + tag', async () => {
    const client = fakeClient(releaseJson(), manifestJson())
    await fetchGithubPayload(client, REPO, TAG, ASSET_NAME)
    expect(client.calls[0]).toBe(
      'https://api.github.com/repos/gustavobrunodev/hive/releases/tags/v0.2.0'
    )
  })

  it('percent-encodes each repo path segment and the tag', async () => {
    const client = fakeClient(releaseJson(), manifestJson())
    await fetchGithubPayload(client, 'weird org/weird repo', 'v1.0.0-beta+1', ASSET_NAME)
    expect(client.calls[0]).toBe(
      'https://api.github.com/repos/weird%20org/weird%20repo/releases/tags/v1.0.0-beta%2B1'
    )
  })

  it('happy path: resolves the installer download URL, integrity and descriptor', async () => {
    const client = fakeClient(releaseJson(), manifestJson())
    const result = await fetchGithubPayload(client, REPO, TAG, ASSET_NAME)

    expect(result.payload).toEqual({
      downloadUrl: INSTALLER_URL,
      integrity: `sha512-${SHA512}`,
      bytes: 96123456
    })
    expect(result.descriptor).toEqual({
      version: '0.2.0',
      platform: 'win32',
      arch: 'x64',
      installer: ASSET_NAME,
      bytes: 96123456,
      sha512: SHA512
    })
    // The manifest asset's own browser_download_url was fetched as JSON, not derived from assetName.
    expect(client.calls[1]).toBe(MANIFEST_URL)
  })

  it('does not double-prefix a manifest sha512 that already carries "sha512-"', async () => {
    const client = fakeClient(releaseJson(), manifestJson({ sha512: `sha512-${SHA512}` }))
    const result = await fetchGithubPayload(client, REPO, TAG, ASSET_NAME)
    expect(result.payload.integrity).toBe(`sha512-${SHA512}`)
  })

  it('bytes is null when the installer asset reports no usable size', async () => {
    const client = fakeClient(
      releaseJson({
        assets: [
          { name: ASSET_NAME, browser_download_url: INSTALLER_URL, size: 0 },
          { name: 'hive-update.json', browser_download_url: MANIFEST_URL, size: 512 }
        ]
      }),
      manifestJson()
    )
    const result = await fetchGithubPayload(client, REPO, TAG, ASSET_NAME)
    expect(result.payload.bytes).toBeNull()
  })

  it('rejects when the release lookup itself rejects (e.g. a 404 for a tag that does not exist yet)', async () => {
    const client = failingClient(new Error('GitHub request failed (404)'))
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      'GitHub request failed (404)'
    )
  })

  it('rejects when the release response is not a JSON object', async () => {
    const client = fakeClient('not an object', manifestJson())
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /not a JSON object/
    )
  })

  it('rejects when the release has no assets array at all', async () => {
    const client = fakeClient({ tag_name: TAG }, manifestJson())
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /no asset named/
    )
  })

  it('rejects when the installer asset is missing from the release', async () => {
    const client = fakeClient(
      releaseJson({
        assets: [{ name: 'hive-update.json', browser_download_url: MANIFEST_URL, size: 512 }]
      }),
      manifestJson()
    )
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      `GitHub release ${REPO}@${TAG} has no asset named "${ASSET_NAME}".`
    )
  })

  it('rejects when the hive-update.json manifest asset is missing from the release', async () => {
    const client = fakeClient(
      releaseJson({
        assets: [{ name: ASSET_NAME, browser_download_url: INSTALLER_URL, size: 123 }]
      }),
      manifestJson()
    )
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /no "hive-update\.json" manifest asset/
    )
  })

  it('rejects when an asset entry is missing a usable browser_download_url', async () => {
    const client = fakeClient(
      releaseJson({
        assets: [
          { name: ASSET_NAME, browser_download_url: '', size: 123 },
          { name: 'hive-update.json', browser_download_url: MANIFEST_URL, size: 512 }
        ]
      }),
      manifestJson()
    )
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /no asset named/
    )
  })

  it('rejects when the manifest is not a JSON object', async () => {
    const client = fakeClient(releaseJson(), 'not an object')
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /is not a JSON object/
    )
  })

  it('rejects when the manifest is missing required fields', async () => {
    const client = fakeClient(releaseJson(), { version: '0.2.0' })
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /missing required fields/
    )
  })

  it('rejects when the manifest has wrong field types', async () => {
    const client = fakeClient(releaseJson(), manifestJson({ bytes: 'not-a-number' }))
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /missing required fields/
    )
  })

  it('rejects when the manifest sha512 is an empty string', async () => {
    const client = fakeClient(releaseJson(), manifestJson({ sha512: '' }))
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow(
      /missing required fields/
    )
  })

  it('rejects when the manifest fetch itself rejects', async () => {
    const calls: string[] = []
    const client: GithubClient = {
      async fetchJson(url: string): Promise<unknown> {
        calls.push(url)
        if (url.includes('/repos/')) return releaseJson()
        throw new Error('ECONNRESET')
      }
    }
    await expect(fetchGithubPayload(client, REPO, TAG, ASSET_NAME)).rejects.toThrow('ECONNRESET')
  })
})
