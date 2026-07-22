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
 * rejects on cue.
 */
export interface RegistryClient {
  fetchJson(url: string): Promise<unknown>
}

/** What the app needs to know about the `latest` dist-tag (design.md §2/§3). */
export interface ReleaseInfo {
  version: string
  notes: string | null
  /** The platform package name to fetch next, or `null` if this platform has no payload for this release. */
  platformPackage: string | null
}

/** What the app needs to download and verify the platform payload (design.md §2/§3). */
export interface PayloadInfo {
  tarballUrl: string
  /** SRI string, e.g. `"sha512-…"`. */
  integrity: string
  bytes: number | null
}

const REGISTRY_ORIGIN = 'https://registry.npmjs.org'

/**
 * A `ReleaseInfo` used whenever discovery cannot determine anything real —
 * `version: '0.0.0'` is a deliberate sentinel: `isNewer('0.0.0', current)` is
 * false against any real installed version, so a caller that naively compares
 * without checking `platformPackage` still lands on "no update" rather than a
 * false positive. `platformPackage: null` is the actual "nothing to offer"
 * signal callers are expected to check (ND-R2.4).
 */
const NO_RELEASE: ReleaseInfo = { version: '0.0.0', notes: null, platformPackage: null }

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
 * a missing/malformed `hiveRelease`, a non-object `platforms`, or a missing
 * entry for this platform+arch all resolve to `platformPackage: null`
 * (ND-R2.4). `notes` follows the same rule independently — a real version
 * with no notes (or a malformed `notes` field) is not itself a failure.
 */
function parseHiveRelease(
  json: Record<string, unknown>,
  key: string
): { notes: string | null; platformPackage: string | null } {
  const hiveRelease = json.hiveRelease
  if (!isRecord(hiveRelease)) {
    return { notes: null, platformPackage: null }
  }
  const notes = typeof hiveRelease.notes === 'string' ? hiveRelease.notes : null
  const platforms = hiveRelease.platforms
  const entry = isRecord(platforms) ? platforms[key] : undefined
  const platformPackage = typeof entry === 'string' && entry !== '' ? entry : null
  return { notes, platformPackage }
}

/**
 * `GET /<pkg>/latest` — the version *and* release metadata in one document
 * (design.md §2). Every parsing step degrades to `NO_RELEASE` (or a partial
 * default) rather than throwing: a rejecting `fetchJson` (offline, 5xx,
 * timeout), a non-JSON-object body, a missing/non-string `version`, and a
 * missing/malformed `hiveRelease` are all "couldn't determine, try again
 * later" outcomes a caller can treat uniformly (ND-R2.4) — this function
 * never throws and never leaves an unhandled rejection.
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
  const { notes, platformPackage } = parseHiveRelease(
    json,
    platformKey(process.platform, process.arch)
  )

  return { version, notes, platformPackage }
}

/**
 * `GET /<platform-pkg>/<version>` — resolves the download payload for an
 * already-discovered release (design.md §2). Unlike `fetchLatestRelease`,
 * this is only ever called after an explicit user action (accepting an
 * offered update, ND-R5.1) rather than silent background discovery, so it
 * deliberately does **not** swallow failures into a sentinel value: a
 * rejecting `fetchJson` or a response missing `dist.tarball`/`dist.integrity`
 * rejects here too, so the caller (T6's `updateService`) can surface it as a
 * visible `error` (kind `'network'`) rather than silently doing nothing with
 * a payload that doesn't exist.
 */
export async function fetchPayload(
  client: RegistryClient,
  pkg: string,
  version: string
): Promise<PayloadInfo> {
  const url = `${REGISTRY_ORIGIN}/${encodePackageName(pkg)}/${encodeURIComponent(version)}`
  const json = await client.fetchJson(url)

  if (!isRecord(json) || !isRecord(json.dist)) {
    throw new Error(`Registry response for ${pkg}@${version} has no "dist" metadata.`)
  }
  const { tarball, integrity, unpackedSize } = json.dist as Record<string, unknown>
  if (typeof tarball !== 'string' || tarball === '') {
    throw new Error(`Registry response for ${pkg}@${version} has no dist.tarball.`)
  }
  if (typeof integrity !== 'string' || integrity === '') {
    throw new Error(`Registry response for ${pkg}@${version} has no dist.integrity.`)
  }
  const bytes =
    typeof unpackedSize === 'number' && Number.isFinite(unpackedSize) ? unpackedSize : null

  return { tarballUrl: tarball, integrity, bytes }
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
