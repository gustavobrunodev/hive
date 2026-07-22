#!/usr/bin/env node
/**
 * scripts/release.mjs — npm release pipeline for Hive Desktop (T16, ND-R1).
 *
 * Order of operations (ND-R1.6 — the main package's `latest` must never point
 * at a payload that isn't live yet):
 *
 *   1. verify   — clean git tree + authenticated npm session
 *   2. build    — `npm run build:win` (electron-vite + electron-builder NSIS)
 *   3. assemble — a scratch platform-package directory: generated
 *                 package.json + the single installer + hive-update.json
 *   4. publish  — the platform package FIRST, then the main package LAST
 *
 * `--dry-run` runs steps 1-3 for real (nothing is uploaded either way) and
 * uses `npm publish --dry-run` for step 4, which prints the exact tarball
 * contents of both packages — the required ND-R1.5/ND-R7.4 inspection gate
 * before any real publish ever happens.
 *
 * This is a build/release tool, not shipped application code — plain Node,
 * no bundler, no TypeScript. It is deliberately defensive: a botched release
 * is expensive to unwind, so every step fails loudly and stops rather than
 * limping forward.
 */

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  copyFileSync,
  statSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Root of the hive-desktop package (parent of scripts/). */
export const ROOT = path.resolve(__dirname, '..')

/** Where electron-builder writes its output by default (no `directories.output` override in electron-builder.yml). */
export const BUILDER_OUT_DIR = path.join(ROOT, 'dist')

/** Scratch directory the platform package(s) get assembled into before publish. Gitignored. */
export const DIST_NPM_DIR = path.join(ROOT, 'dist-npm')

/**
 * v1 ships Windows/x64 only (ND-C6) — macOS/Linux strategies are deferred.
 * `key` matches the shape used by `hiveRelease.platforms` in package.json
 * and by the future `main/npmRegistry.ts` `platformKey()` helper (design §3).
 */
export const TARGET = { platform: 'win32', arch: 'x64', key: 'win32-x64' }

function log(message) {
  console.log(`[release] ${message}`)
}

function fail(message) {
  console.error(`[release] ERROR: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing (no process/git/fs side effects).
// ---------------------------------------------------------------------------

/**
 * The platform package name for a given target, as declared in the main
 * package's own `hiveRelease.platforms` map — the single source of truth so
 * the generated package and the main package's advertised pointer can never
 * drift apart.
 */
export function platformPackageName(mainPkg, targetKey = TARGET.key) {
  const name = mainPkg?.hiveRelease?.platforms?.[targetKey]
  if (!name) {
    throw new Error(
      `main package.json is missing hiveRelease.platforms["${targetKey}"] — ` +
        `nothing to publish this platform payload as.`
    )
  }
  return name
}

/** The generated `package.json` for the platform payload package (design.md §4). */
export function buildPlatformPackageJson(mainPkg, installerFilename, target = TARGET) {
  return {
    name: platformPackageName(mainPkg, target.key),
    version: mainPkg.version,
    description: `Installer payload (${target.platform}/${target.arch}) for ${mainPkg.name}. Not runnable on its own — downloaded and applied by the app's self-updater.`,
    private: false,
    license: mainPkg.license,
    repository: mainPkg.repository,
    homepage: mainPkg.homepage,
    author: mainPkg.author,
    os: [target.platform],
    cpu: [target.arch],
    publishConfig: { access: 'public' },
    files: [installerFilename, 'hive-update.json']
  }
}

/** The `hive-update.json` descriptor shape, exactly per design.md §4. */
export function buildUpdateDescriptor(mainPkg, installerFilename, bytes, target = TARGET) {
  return {
    version: mainPkg.version,
    platform: target.platform,
    arch: target.arch,
    installer: installerFilename,
    bytes
  }
}

// ---------------------------------------------------------------------------
// Step 1 — verify
// ---------------------------------------------------------------------------

function readMainPackageJson() {
  return JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
}

/** Throws-free: returns the clean/dirty `git status --porcelain` output. */
export function gitStatusPorcelain() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' })
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

function verify(dryRun) {
  assertCleanTree()

  const whoami = npmWhoami()
  if (whoami) {
    log(`authenticated to npm as "${whoami}".`)
    return
  }

  if (dryRun) {
    log(
      'warning: not logged in to npm (`npm whoami` failed). This dry-run does not need ' +
        'auth, but a real `npm run release` right after this would fail — run `npm login` first.'
    )
    return
  }

  fail('not logged in to npm — run `npm login` (or configure an automation token) and try again.')
}

// ---------------------------------------------------------------------------
// Step 2 — build
// ---------------------------------------------------------------------------

function build() {
  log('building the Windows installer (npm run build:win)…')
  execFileSync('npm', ['run', 'build:win'], { cwd: ROOT, stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// Step 3 — assemble the platform package directory
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

function assemblePlatformPackage(mainPkg) {
  const installerFilename = findInstaller()
  const srcInstaller = path.join(BUILDER_OUT_DIR, installerFilename)

  const pkgName = platformPackageName(mainPkg)
  const pkgDirName = pkgName.split('/').pop() // "@scope/hive-desktop-win-x64" -> "hive-desktop-win-x64"
  const pkgDir = path.join(DIST_NPM_DIR, pkgDirName)

  rmSync(pkgDir, { recursive: true, force: true })
  mkdirSync(pkgDir, { recursive: true })

  const destInstaller = path.join(pkgDir, installerFilename)
  copyFileSync(srcInstaller, destInstaller)
  const bytes = statSync(destInstaller).size

  const descriptor = buildUpdateDescriptor(mainPkg, installerFilename, bytes)
  writeFileSync(path.join(pkgDir, 'hive-update.json'), JSON.stringify(descriptor, null, 2) + '\n')

  const platformPkgJson = buildPlatformPackageJson(mainPkg, installerFilename)
  writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(platformPkgJson, null, 2) + '\n')

  log(`assembled platform package "${pkgName}" at ${pkgDir}`)
  log(`  installer: ${installerFilename} (${bytes} bytes)`)

  return pkgDir
}

// ---------------------------------------------------------------------------
// Step 4 — publish (platform first, main last — ND-R1.6)
// ---------------------------------------------------------------------------

function npmPublish(cwd, dryRun) {
  const args = dryRun ? ['publish', '--dry-run'] : ['publish']
  execFileSync('npm', args, { cwd, stdio: 'inherit' })
}

function confirmMainMetadata(mainPkg) {
  const entry = mainPkg?.hiveRelease?.platforms?.[TARGET.key]
  if (!entry) {
    fail(
      `main package.json hiveRelease.platforms["${TARGET.key}"] is missing — nothing to point at.`
    )
  }
  if (!mainPkg.hiveRelease.notes) {
    log('warning: hiveRelease.notes is empty — the offered update will ship without release notes.')
  }
  log(`main package "${mainPkg.name}"@${mainPkg.version} -> platform package "${entry}"`)
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function main() {
  const dryRun = process.argv.includes('--dry-run')
  log(
    dryRun
      ? 'running in --dry-run mode — nothing will actually be published.'
      : 'running a REAL release.'
  )

  verify(dryRun)
  build()

  const mainPkg = readMainPackageJson()
  const platformDir = assemblePlatformPackage(mainPkg)
  confirmMainMetadata(mainPkg)

  log('publishing the platform package first (ND-R1.6)…')
  npmPublish(platformDir, dryRun)

  log('publishing the main package last…')
  npmPublish(ROOT, dryRun)

  log(dryRun ? 'dry-run complete — nothing was published.' : 'release complete.')
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isMainModule) {
  try {
    main()
  } catch (err) {
    // Any unexpected failure (a build/publish subprocess exiting non-zero, a
    // filesystem error while assembling the platform package, …) is reported
    // through the same clean `[release] ERROR:` channel instead of a raw
    // Node stack trace — the child's own output already streamed live via
    // `stdio: 'inherit'`, so this is just the closing, unambiguous verdict.
    fail(`release failed: ${err.message}`)
  }
}
