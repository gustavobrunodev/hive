import semver from 'semver'

/**
 * The injectable HTTP layer this module needs (the `DialogLike` / `McpProbe`
 * DI precedent): a single `fetchJson(url)` that resolves to already-parsed
 * JSON, or rejects for anything that stops it getting there (offline, DNS,
 * a non-2xx status, a timeout). Keeping the whole registry client behind one
 * method means this module never imports `electron`, `node:https`, or
 * `node:fetch` itself, and is fully unit-testable against fixtures — no
 * network in the suite (ND-R7.3). The real implementation (T6) wires in a
 * `fetch`-based client with a timeout; tests wire in a fake that resolves or
 * rejects on cue. `updateService.ts` (T22, ND-C7/D21) reuses this same
 * concrete client for GitHub Releases API calls too — it's the identical
 * shape ("fetch this URL, hand back parsed JSON"), so one client instance
 * covers both origins.
 */
export interface RegistryClient {
  fetchJson(url: string): Promise<unknown>
}

/** What the app needs to know about the `latest` dist-tag (design.md §2/§2A). */
export interface ReleaseInfo {
  version: string
  notes: string | null
  /**
   * The GitHub repo (`"owner/repo"`) hosting this release's installer +
   * `hive-update.json` manifest (design.md §2A, ND-C7/D21), or `null` if
   * `hiveRelease` doesn't declare one.
   */
  repo: string | null
  /**
   * The installer asset file name to look up on that GitHub Release, or
   * `null` if this platform has no payload for this release. Was
   * `platformPackage` (an npm package name) before ND-C7's payload-host
   * pivot — it's an asset file name now, not a package name.
   */
  platformAsset: string | null
}

const REGISTRY_ORIGIN = 'https://registry.npmjs.org'

/**
 * A `ReleaseInfo` used whenever discovery cannot determine anything real —
 * `version: '0.0.0'` is a deliberate sentinel: `isNewer('0.0.0', current)` is
 * false against any real installed version, so a caller that naively compares
 * without checking `platformAsset` still lands on "no update" rather than a
 * false positive. `platformAsset: null` (and `repo: null`) is the actual
 * "nothing to offer" signal callers are expected to check (ND-R2.4).
 */
const NO_RELEASE: ReleaseInfo = { version: '0.0.0', notes: null, repo: null, platformAsset: null }

/**
 * URL-encodes an npm package name for use as a registry path segment. Scoped
 * names (`@user/pkg`) need their `/` encoded as `%2F`, but the `@` stays
 * literal — that's how the registry expects it (design.md §2:
 * `@user%2Fpkg`), so this is a targeted replace rather than a blanket
 * `encodeURIComponent` (which would also escape the `@`).
 */
function encodePackageName(pkg: string): string {
  return pkg.replace(/\//g, '%2F')
}

/** The `hiveRelease.platforms` key for a given platform+arch (e.g. `"win32-x64"`). */
export function platformKey(platform: NodeJS.Platform, arch: string): string {
  return `${platform}-${arch}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reads the `hiveRelease` custom field off a `/latest` response, degrading to
 * "nothing published for this platform" at every step rather than throwing:
 * a missing/malformed `hiveRelease`, a non-object `platforms`, a missing
 * entry for this platform+arch, or a missing `repo` all resolve to their
 * respective `null` (ND-R2.4). `notes` follows the same rule independently —
 * a real version with no notes (or a malformed `notes` field) is not itself
 * a failure.
 */
function parseHiveRelease(
  json: Record<string, unknown>,
  key: string
): { notes: string | null; repo: string | null; platformAsset: string | null } {
  const hiveRelease = json.hiveRelease
  if (!isRecord(hiveRelease)) {
    return { notes: null, repo: null, platformAsset: null }
  }
  const notes = typeof hiveRelease.notes === 'string' ? hiveRelease.notes : null
  const repo =
    typeof hiveRelease.repo === 'string' && hiveRelease.repo !== '' ? hiveRelease.repo : null
  const platforms = hiveRelease.platforms
  const entry = isRecord(platforms) ? platforms[key] : undefined
  const platformAsset = typeof entry === 'string' && entry !== '' ? entry : null
  return { notes, repo, platformAsset }
}

/**
 * `GET /<pkg>/latest` — the version *and* release metadata in one document
 * (design.md §2). Every parsing step degrades to `NO_RELEASE` (or a partial
 * default) rather than throwing: a rejecting `fetchJson` (offline, 5xx,
 * timeout), a non-JSON-object body, a missing/non-string `version`, and a
 * missing/malformed `hiveRelease` are all "couldn't determine, try again
 * later" outcomes a caller can treat uniformly (ND-R2.4) — this function
 * never throws and never leaves an unhandled rejection.
 *
 * Unchanged in its core npm-querying logic by ND-C7's payload-host pivot
 * (design.md §2A) — npm remains the version source. Only `ReleaseInfo`'s
 * shape changed (`platformPackage` -> `platformAsset`, plus the new `repo`
 * field), both still read from this same `hiveRelease` object.
 */
export async function fetchLatestRelease(
  client: RegistryClient,
  pkg: string
): Promise<ReleaseInfo> {
  let json: unknown
  try {
    json = await client.fetchJson(`${REGISTRY_ORIGIN}/${encodePackageName(pkg)}/latest`)
  } catch {
    return NO_RELEASE
  }

  if (!isRecord(json)) {
    return NO_RELEASE
  }

  const version = typeof json.version === 'string' && json.version !== '' ? json.version : '0.0.0'
  const { notes, repo, platformAsset } = parseHiveRelease(
    json,
    platformKey(process.platform, process.arch)
  )

  return { version, notes, repo, platformAsset }
}

/**
 * Correct semver precedence (ND-R2.2) — never a string compare (`"0.10.0" <
 * "0.9.0"` would be true lexically, wrong numerically). Either side failing
 * to parse as semver degrades to `false` ("no update") rather than throwing,
 * matching this module's overall defensive posture.
 */
export function isNewer(candidate: string, current: string): boolean {
  if (!semver.valid(candidate) || !semver.valid(current)) {
    return false
  }
  return semver.gt(candidate, current)
}
