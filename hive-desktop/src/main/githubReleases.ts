/**
 * GitHub Releases payload resolution (npm-distribution pivot, ND-C7/D21,
 * design.md §2A): npm remains the app's *version source* (`npmRegistry.ts`'s
 * `fetchLatestRelease` is unchanged in that role), but the actual installer
 * and its integrity manifest now live as assets on a GitHub Release instead
 * of a second, per-platform npm package. The real ~297 MB Windows installer
 * got a genuine `npm error code E413 — 413 Payload Too Large` on the first
 * real `npm publish` of that platform package (STATE.md D21) — GitHub
 * Releases have a documented ~2 GB per-asset ceiling with enormous headroom
 * by comparison.
 *
 * Pure module, no Electron import, same injected-client DI shape as
 * `npmRegistry.ts` (the `DialogLike`/`McpProbe` precedent): a single
 * `fetchJson(url)` seam covers both the GitHub REST call (the release
 * lookup) and the manifest asset fetch (also JSON, served straight off its
 * `browser_download_url`) — one seam, zero network in tests (ND-R7.3).
 *
 * `GithubClient` is declared locally here rather than imported from
 * `npmRegistry.ts`'s `RegistryClient`: the two shapes are identical by
 * design (both are just "fetch this URL, hand back parsed JSON"), but this
 * module has zero dependency on `npmRegistry.ts` — the two can change
 * independently, and a caller (`updateService.ts`) is free to pass the same
 * concrete client instance to both, which is exactly what it does.
 */

export interface GithubClient {
  fetchJson(url: string): Promise<unknown>
}

/**
 * What `updateDownload.ts`'s `downloadAndVerifyInstaller` needs to fetch and
 * verify the installer. Mirrors that module's own `PayloadInfo` shape
 * structurally (both are `{ downloadUrl, integrity, bytes }`) rather than
 * importing it: this module stays a self-contained, zero-cross-import unit,
 * and TypeScript's structural typing means a caller can hand a
 * `GithubPayloadInfo` to a function expecting `PayloadInfo` (or vice versa)
 * with no conversion — the field names and types simply have to agree,
 * which they do by construction.
 */
export interface GithubPayloadInfo {
  downloadUrl: string
  /** SRI string, e.g. `"sha512-…"` — built from the manifest's `sha512` field (GitHub has no built-in content hash). */
  integrity: string
  bytes: number | null
}

/**
 * The `hive-update.json` manifest asset, uploaded by `scripts/release.mjs`
 * alongside the installer (design.md §2A) — the closest thing to npm's
 * `dist.integrity` this mechanism has, since GitHub release assets carry no
 * built-in content hash of their own.
 */
export interface UpdateDescriptor {
  version: string
  platform: string
  arch: string
  /** Installer asset file name — matches `hiveRelease.platforms[key]` from `npmRegistry.ts`'s `ReleaseInfo.platformAsset`. */
  installer: string
  bytes: number
  /** Base64 sha512 digest, no `sha512-` prefix (the prefix is added when building `GithubPayloadInfo.integrity`). */
  sha512: string
}

const GITHUB_API_ORIGIN = 'https://api.github.com'

/** Fixed, known filename — NOT derived from the installer's own asset name (design.md §2A). */
const MANIFEST_ASSET_NAME = 'hive-update.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * `owner/repo` -> URL path segments, each individually percent-encoded.
 * GitHub's path shape differs from npm's scoped-package one (no literal `@`
 * to preserve), but the same care applies: never trust a raw slash-bearing
 * string straight into a URL path.
 */
function encodeRepoPath(repo: string): string {
  return repo
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

interface RawAsset {
  name: string
  browser_download_url: string
  size: number
}

/**
 * Finds an asset by exact name in a release's `assets` array, validating
 * its shape as it goes. Returns `null` for anything that doesn't check out
 * — a non-array `assets`, no matching name, or a matching entry missing a
 * usable `browser_download_url` — so the caller can raise one clear,
 * specific error per missing piece rather than a generic parse failure.
 */
function findAsset(assets: unknown, name: string): RawAsset | null {
  if (!Array.isArray(assets)) return null
  for (const item of assets) {
    if (!isRecord(item) || item.name !== name) continue
    const url = item.browser_download_url
    if (typeof url !== 'string' || url === '') continue
    const size = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0
    return { name, browser_download_url: url, size }
  }
  return null
}

/**
 * Parses and validates the `hive-update.json` manifest. Defensive like
 * `npmRegistry.ts`'s own parsing, but this function throws rather than
 * degrading — `fetchGithubPayload` is only ever called after an explicit
 * user action or a real discovered release (mirroring `npmRegistry.ts`'s
 * `fetchPayload` — not `fetchLatestRelease` — in being allowed to throw),
 * so a malformed manifest should surface as a clear, actionable error.
 */
function parseDescriptor(json: unknown): UpdateDescriptor {
  if (!isRecord(json)) {
    throw new Error(`${MANIFEST_ASSET_NAME} is not a JSON object.`)
  }
  const { version, platform, arch, installer, bytes, sha512 } = json
  if (
    typeof version !== 'string' ||
    typeof platform !== 'string' ||
    typeof arch !== 'string' ||
    typeof installer !== 'string' ||
    typeof bytes !== 'number' ||
    typeof sha512 !== 'string' ||
    sha512 === ''
  ) {
    throw new Error(`${MANIFEST_ASSET_NAME} is missing required fields.`)
  }
  return { version, platform, arch, installer, bytes, sha512 }
}

/** Normalizes a manifest's `sha512` field into the `sha512-<base64>` SRI form, without double-prefixing. */
function toIntegrity(sha512: string): string {
  return `sha512-${sha512.replace(/^sha512-/, '')}`
}

/**
 * Resolves a release's installer payload + manifest via the GitHub REST API
 * (design.md §2A resolution flow, steps 2 onward):
 *
 *   1. `GET /repos/<repo>/releases/tags/<tag>` — the release's asset list.
 *   2. Find the installer asset named `assetName` in it.
 *   3. Find the `hive-update.json` manifest asset alongside it.
 *   4. Fetch the manifest's `browser_download_url` as JSON and parse it.
 *
 * Only ever called after an explicit user action or a real discovered
 * release, so it deliberately does not swallow failures into a sentinel
 * value (unlike `npmRegistry.ts`'s `fetchLatestRelease`): a rejecting
 * `fetchJson` (including a 404 for a release that doesn't exist yet), a
 * missing installer asset, a missing manifest asset, or a malformed
 * manifest all reject here, each with a distinct, specific message, so the
 * caller (`updateService.ts`) can surface something actionable as a visible
 * `error` event rather than silently doing nothing.
 */
export async function fetchGithubPayload(
  client: GithubClient,
  repo: string,
  tag: string,
  assetName: string
): Promise<{ payload: GithubPayloadInfo; descriptor: UpdateDescriptor }> {
  const url = `${GITHUB_API_ORIGIN}/repos/${encodeRepoPath(repo)}/releases/tags/${encodeURIComponent(tag)}`
  const json = await client.fetchJson(url)

  if (!isRecord(json)) {
    throw new Error(`GitHub release ${repo}@${tag}: response was not a JSON object.`)
  }

  const installerAsset = findAsset(json.assets, assetName)
  if (!installerAsset) {
    throw new Error(`GitHub release ${repo}@${tag} has no asset named "${assetName}".`)
  }

  const manifestAsset = findAsset(json.assets, MANIFEST_ASSET_NAME)
  if (!manifestAsset) {
    throw new Error(`GitHub release ${repo}@${tag} has no "${MANIFEST_ASSET_NAME}" manifest asset.`)
  }

  const manifestJson = await client.fetchJson(manifestAsset.browser_download_url)
  const descriptor = parseDescriptor(manifestJson)

  return {
    payload: {
      downloadUrl: installerAsset.browser_download_url,
      integrity: toIntegrity(descriptor.sha512),
      bytes: installerAsset.size > 0 ? installerAsset.size : null
    },
    descriptor
  }
}
