#!/usr/bin/env node
/**
 * scripts/release.mjs — release pipeline for Hive Desktop (T16, ND-R1;
 * payload host pivoted to GitHub Releases by T23, ND-C7/D21, design.md §2A).
 *
 * Order of operations (ND-R1.6 — the main package's `latest` must never point
 * at a payload that isn't live yet):
 *
 *   1. verify   — clean git tree + authenticated npm session + GITHUB_TOKEN
 *   2. build    — `npm run build:win` (electron-vite + electron-builder NSIS)
 *   3. github   — create (or reuse) a GitHub Release tagged `v<version>`,
 *                 upload the installer + a freshly computed `hive-update.json`
 *                 (now including a real sha512) as release assets
 *   4. publish  — the (small, metadata-only) main npm package, LAST
 *
 * `--dry-run` runs steps 1-3 for real wherever that's possible without a
 * token (the build, and the read-only "does this release already exist"
 * GitHub lookup — confirmed unauthenticated-safe live, design.md §2A) and
 * uses `npm publish --dry-run` for step 4, which prints the exact tarball
 * contents of the main package — the required ND-R1.5/ND-R7.4 inspection
 * gate before any real publish ever happens. It never creates a release or
 * uploads an asset, and needs no `GITHUB_TOKEN` at all.
 *
 * This is a build/release tool, not shipped application code — plain Node,
 * no bundler, no TypeScript. It is deliberately defensive: a botched release
 * is expensive to unwind, so every step fails loudly and stops rather than
 * limping forward.
 *
 * ND-C7/D21 background: the platform installer used to be published as its
 * own npm package (`assemblePlatformPackage` + `npm publish` on that
 * directory). The real ~297 MB installer got a genuine `413 Payload Too
 * Large` on the first real publish attempt — npm's real (undocumented)
 * per-tarball limit is below that. The payload host moved to a GitHub
 * Release instead (documented ~2 GB per-asset ceiling, confirmed live); npm
 * remains the *version source* only (`hiveRelease` on the main package,
 * unchanged in that role).
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  rmSync,
  readdirSync,
  createReadStream,
  statSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Root of the hive-desktop package (parent of scripts/). */
export const ROOT = path.resolve(__dirname, '..')

/** Where electron-builder writes its output by default (no `directories.output` override in electron-builder.yml). */
export const BUILDER_OUT_DIR = path.join(ROOT, 'dist')

/**
 * v1 ships Windows/x64 only (ND-C6) — macOS/Linux strategies are deferred.
 * `key` matches the shape used by `hiveRelease.platforms` in package.json
 * and `main/npmRegistry.ts`'s `platformKey()` helper (design §3).
 */
export const TARGET = { platform: 'win32', arch: 'x64', key: 'win32-x64' }

const GITHUB_API_ORIGIN = 'https://api.github.com'
const MANIFEST_ASSET_NAME = 'hive-update.json'
const USER_AGENT = 'hive-desktop-release-script'

// A release lookup is one small JSON GET — same "single request, shouldn't
// ever hang" budget as `updateService.ts`'s own registry/GitHub timeout
// (REGISTRY_TIMEOUT_MS). Not applied to the asset upload: a ~300 MB installer
// over a slow connection is legitimately slow, not stuck.
const GITHUB_LOOKUP_TIMEOUT_MS = 8_000

function log(message) {
  console.log(`[release] ${message}`)
}

function fail(message) {
  console.error(`[release] ERROR: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing (no process/git/fs/network side effects).
// ---------------------------------------------------------------------------

/** The tag `main/updateService.ts` looks a release up under for a given version (design.md §2A: `v<version>`). */
export function releaseTagFor(version) {
  return `v${version}`
}

/**
 * The GitHub repo (`"owner/repo"`) to publish releases to, as declared in
 * the main package's own `hiveRelease.repo` — the single source of truth so
 * the release script and the running app's discovery path can never point
 * at different repos.
 */
export function resolveGithubRepo(mainPkg) {
  const repo = mainPkg?.hiveRelease?.repo
  if (!repo) {
    throw new Error(
      'main package.json is missing hiveRelease.repo — nothing to publish the GitHub Release to.'
    )
  }
  return repo
}

/** The `hive-update.json` descriptor shape, per design.md §2A (now carries a real `sha512`). */
export function buildUpdateDescriptor(mainPkg, installerFilename, bytes, sha512, target = TARGET) {
  return {
    version: mainPkg.version,
    platform: target.platform,
    arch: target.arch,
    installer: installerFilename,
    bytes,
    sha512
  }
}

/**
 * Decides "create vs. reuse" from a (possibly `null`, meaning "not found")
 * release-lookup response — pure and independently testable without a real
 * GitHub API call (ND-B2: no token/live auth available in this environment,
 * so the authenticated create/upload path can't be exercised end-to-end
 * here, but this decision logic can be).
 */
export function decideReleaseAction(existingRelease) {
  return existingRelease ? { action: 'reuse', release: existingRelease } : { action: 'create' }
}

// ---------------------------------------------------------------------------
// Step 1 — verify
// ---------------------------------------------------------------------------

function readMainPackageJson() {
  return JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
}

/**
 * Throws-free: returns the clean/dirty `git status --porcelain` output,
 * scoped to this directory (`.`, i.e. `hive-desktop/`) rather than the whole
 * monorepo — this is a release of *this* package, so uncommitted clutter
 * elsewhere in the repo (another product, root-level scratch files) must
 * never block it. Found live: a real dry-run failed the dirty-tree check
 * against unrelated root-level files that predate this feature entirely.
 */
export function gitStatusPorcelain() {
  return execFileSync('git', ['status', '--porcelain', '.'], { cwd: ROOT, encoding: 'utf8' })
}

function assertCleanTree() {
  const status = gitStatusPorcelain()
  if (status.trim().length > 0) {
    fail('the git tree is dirty — commit or stash your changes before releasing:\n' + status)
  }
  log('git tree is clean.')
}

/** Returns the authenticated npm username, or `null` if not logged in. Never throws. */
export function npmWhoami() {
  try {
    // stderr is suppressed here: an unauthenticated `npm whoami` prints its
    // own noisy 401 stack to stderr, and we already surface a clean,
    // purpose-written message in `verify()` — no need for both.
    return execFileSync('npm', ['whoami'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return null
  }
}

/**
 * Verifies both prerequisites this pipeline needs authentication for — npm
 * (the final `publish` step) and GitHub (the release-creation/asset-upload
 * step, ND-B2) — up front, before the (slow) build even starts, exactly
 * mirroring the existing `npmWhoami()`-absent handling: a real run refuses
 * cleanly with an actionable message; a `--dry-run` only warns, since dry-run
 * needs neither (the GitHub release-existence check it does perform is
 * unauthenticated and works for a public repo, design.md §2A).
 */
function verify(dryRun) {
  assertCleanTree()

  const whoami = npmWhoami()
  if (whoami) {
    log(`authenticated to npm as "${whoami}".`)
  } else if (dryRun) {
    log(
      'warning: not logged in to npm (`npm whoami` failed). This dry-run does not need ' +
        'auth, but a real `npm run release` right after this would fail — run `npm login` first.'
    )
  } else {
    fail('not logged in to npm — run `npm login` (or configure an automation token) and try again.')
  }

  if (process.env.GITHUB_TOKEN) {
    log('GITHUB_TOKEN is set.')
  } else if (dryRun) {
    log(
      'warning: GITHUB_TOKEN is not set. This dry-run does not need it — the release-existence ' +
        'check is unauthenticated for a public repo — but a real `npm run release` right after ' +
        'this would fail. Export a personal access token with `repo` (or fine-grained ' +
        '"contents: write") scope on the target repo, e.g. `export GITHUB_TOKEN=$(gh auth token)`.'
    )
  } else {
    fail(
      'GITHUB_TOKEN is not set — export a personal access token with `repo` (or fine-grained ' +
        '"contents: write") scope on the target repo as GITHUB_TOKEN ' +
        '(e.g. `export GITHUB_TOKEN=$(gh auth token)`) and try again.'
    )
  }
}

// ---------------------------------------------------------------------------
// Step 2 — build
// ---------------------------------------------------------------------------

/**
 * Wipes `out/` and `dist/` before building. Found live: a second `build:win`
 * run on top of an already-populated `dist/win-unpacked` produced an
 * installer roughly **double** the correct size (594 MB vs. the genuine
 * ~297 MB) — electron-builder does not fully replace its previous unpacked
 * output on its own, so a stale `dist/` from an earlier run silently
 * duplicates content (traced to `resources/app.asar.unpacked` growing rather
 * than being replaced) into the next one. That oversized tarball then made
 * `npm publish` itself crash (`ERR_STRING_TOO_LONG`) before any upload
 * happened — so nothing was actually published, but a release must never
 * depend on the working directory happening to be pristine to produce a
 * correct artifact.
 */
function cleanBuildOutputs() {
  log('cleaning previous build output (out/, dist/)…')
  rmSync(path.join(ROOT, 'out'), { recursive: true, force: true })
  rmSync(BUILDER_OUT_DIR, { recursive: true, force: true })
}

function build() {
  cleanBuildOutputs()
  log('building the Windows installer (npm run build:win)…')
  execFileSync('npm', ['run', 'build:win'], { cwd: ROOT, stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// Step 3 — GitHub Release: create/reuse + upload assets (ND-C7/D21, design.md §2A)
// ---------------------------------------------------------------------------

function findInstaller() {
  if (!existsSync(BUILDER_OUT_DIR)) {
    fail(
      `electron-builder output directory not found: ${BUILDER_OUT_DIR} — did the build step run?`
    )
  }
  const candidates = readdirSync(BUILDER_OUT_DIR).filter((f) => f.endsWith('-setup.exe'))
  if (candidates.length === 0) {
    fail(`no NSIS installer (*-setup.exe) found in ${BUILDER_OUT_DIR}`)
  }
  if (candidates.length > 1) {
    fail(
      `expected exactly one installer in ${BUILDER_OUT_DIR}, found ${candidates.length}: ` +
        candidates.join(', ')
    )
  }
  return candidates[0]
}

/** Streams the file through sha512 rather than reading it whole — the installer is ~300 MB. */
async function sha512File(filePath) {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk)
  }
  return hash.digest('base64')
}

/**
 * Keeps package.json's advertised installer filename honest against the
 * artifact electron-builder *actually just produced*, rather than a
 * hand-maintained string that would silently go stale on every version
 * bump. Only writes the file back when something changed, so a release that
 * happens to already match makes no spurious diff.
 */
function syncHiveReleaseAsset(mainPkg, installerFilename) {
  const current = mainPkg.hiveRelease?.platforms?.[TARGET.key]
  if (current === installerFilename) return
  mainPkg.hiveRelease.platforms[TARGET.key] = installerFilename
  writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(mainPkg, null, 2) + '\n')
  log(`updated package.json hiveRelease.platforms["${TARGET.key}"] -> "${installerFilename}"`)
}

function encodeRepoPath(repo) {
  return repo
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * `GET /repos/<repo>/releases/tags/<tag>` — real, unauthenticated, read-only
 * (design.md §2A: confirmed live against the real API, no token needed for a
 * public repo). This is what makes re-running the pipeline idempotent: a
 * release that already exists is reused (and its assets replaced) rather
 * than erroring on a duplicate tag. Returns `null` for "not found" (404);
 * throws for anything else, including a timeout — a real run treats that as
 * a genuine failure, but `publishGithubRelease` lets a `--dry-run` degrade
 * to "can't confirm, proceeding informationally" instead of aborting the
 * whole dry-run over a lookup that was only ever informational there.
 */
async function getReleaseByTag(repo, tag) {
  const url = `${GITHUB_API_ORIGIN}/repos/${encodeRepoPath(repo)}/releases/tags/${encodeURIComponent(tag)}`
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(GITHUB_LOOKUP_TIMEOUT_MS)
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed (${response.status}) for ${repo}@${tag}`)
  }
  return response.json()
}

/** `POST /repos/<repo>/releases` — needs `GITHUB_TOKEN` (ND-B2); never called in `--dry-run`. */
async function createGithubRelease(repo, tag, token, notes) {
  const url = `${GITHUB_API_ORIGIN}/repos/${encodeRepoPath(repo)}/releases`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tag_name: tag, name: tag, body: notes || '' })
  })
  if (!response.ok) {
    throw new Error(
      `GitHub release creation failed (${response.status}) for ${repo}@${tag}: ${await response.text()}`
    )
  }
  return response.json()
}

/**
 * Deletes a same-named asset on the release first, if one already exists —
 * GitHub's upload endpoint 422s on a duplicate name, so this is what keeps a
 * re-run's asset upload idempotent (replace, not fail).
 */
async function deleteExistingAsset(repo, release, token, assetName) {
  const existing = (release.assets ?? []).find((asset) => asset.name === assetName)
  if (!existing) return
  const url = `${GITHUB_API_ORIGIN}/repos/${encodeRepoPath(repo)}/releases/assets/${existing.id}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT }
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete existing asset "${assetName}" (${response.status})`)
  }
}

/** Uploads (replacing if present) one asset to a GitHub Release. Needs `GITHUB_TOKEN`. */
async function uploadReleaseAsset(repo, release, token, filePath, assetName, contentType) {
  await deleteExistingAsset(repo, release, token, assetName)
  // `upload_url` is a URI template (`.../assets{?name,label}`) — drop the template tail.
  const uploadUrl = `${release.upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(assetName)}`
  const body = readFileSync(filePath)
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
      'Content-Type': contentType,
      'Content-Length': String(body.length)
    },
    body
  })
  if (!response.ok) {
    throw new Error(
      `Asset upload failed for "${assetName}" (${response.status}): ${await response.text()}`
    )
  }
}

/**
 * Replaces the old "assemble + `npm publish` a platform package" step
 * (ND-C7/D21): computes the real installer sha512, keeps package.json's
 * advertised filename in sync with what was actually built, then creates
 * (or reuses, for idempotent re-runs) a GitHub Release tagged `v<version>`
 * and uploads the installer + a generated `hive-update.json` manifest as
 * release assets. In `--dry-run`, everything up to and including the
 * create-vs-reuse decision runs for real (no token needed); nothing is
 * created or uploaded.
 */
async function publishGithubRelease(mainPkg, dryRun) {
  const installerFilename = findInstaller()
  const installerPath = path.join(BUILDER_OUT_DIR, installerFilename)
  const bytes = statSync(installerPath).size
  const sha512 = await sha512File(installerPath)

  syncHiveReleaseAsset(mainPkg, installerFilename)

  const repo = resolveGithubRepo(mainPkg)
  const tag = releaseTagFor(mainPkg.version)
  const descriptor = buildUpdateDescriptor(mainPkg, installerFilename, bytes, sha512)

  log(`GitHub release target: ${repo}@${tag}`)
  log(`  installer: ${installerFilename} (${bytes} bytes, sha512 ${sha512.slice(0, 12)}…)`)

  let existing = null
  let lookupFailed = false
  try {
    existing = await getReleaseByTag(repo, tag)
  } catch (err) {
    if (!dryRun) throw err
    lookupFailed = true
    log(
      `  warning: could not check for an existing release (${err.message}) — this dry-run ` +
        `can't confirm idempotency here (no network?), but a real release would still perform ` +
        `this check and refuse to proceed if it fails.`
    )
  }

  if (!lookupFailed) {
    const decision = decideReleaseAction(existing)
    log(
      decision.action === 'reuse'
        ? `  release ${tag} already exists (id ${decision.release.id}) — would reuse it (idempotent re-run).`
        : `  release ${tag} does not exist yet — would create it.`
    )
  }

  if (dryRun) {
    log(
      `  --dry-run: would upload assets "${installerFilename}" and "${MANIFEST_ASSET_NAME}" — ` +
        `nothing created or uploaded.`
    )
    return
  }

  const token = process.env.GITHUB_TOKEN // verify() already refused to get here without one.
  const decision = decideReleaseAction(existing)
  const release =
    decision.action === 'reuse'
      ? decision.release
      : await createGithubRelease(repo, tag, token, mainPkg.hiveRelease?.notes)

  const manifestPath = path.join(BUILDER_OUT_DIR, MANIFEST_ASSET_NAME)
  writeFileSync(manifestPath, JSON.stringify(descriptor, null, 2) + '\n')

  log('uploading installer asset…')
  await uploadReleaseAsset(
    repo,
    release,
    token,
    installerPath,
    installerFilename,
    'application/octet-stream'
  )
  log(`uploading ${MANIFEST_ASSET_NAME} manifest asset…`)
  await uploadReleaseAsset(
    repo,
    release,
    token,
    manifestPath,
    MANIFEST_ASSET_NAME,
    'application/json'
  )

  log(`GitHub release ${tag} published with 2 assets.`)
}

// ---------------------------------------------------------------------------
// Step 4 — publish the main npm package (unchanged in spirit, still last — ND-R1.6)
// ---------------------------------------------------------------------------

function npmPublish(cwd, dryRun) {
  const args = dryRun ? ['publish', '--dry-run'] : ['publish']
  execFileSync('npm', args, { cwd, stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  log(
    dryRun
      ? 'running in --dry-run mode — nothing will actually be published.'
      : 'running a REAL release.'
  )

  verify(dryRun)
  build()

  const mainPkg = readMainPackageJson()
  await publishGithubRelease(mainPkg, dryRun)

  log('publishing the main package last (ND-R1.6)…')
  npmPublish(ROOT, dryRun)

  log(dryRun ? 'dry-run complete — nothing was published.' : 'release complete.')
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isMainModule) {
  main().catch((err) => {
    // Any unexpected failure (a build/publish subprocess exiting non-zero, a
    // GitHub API call failing, a filesystem error, …) is reported through the
    // same clean `[release] ERROR:` channel instead of a raw Node stack trace
    // — the child's own output already streamed live via `stdio: 'inherit'`,
    // so this is just the closing, unambiguous verdict.
    fail(`release failed: ${err.message}`)
  })
}
