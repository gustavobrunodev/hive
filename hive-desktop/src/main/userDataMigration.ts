import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'fs'
import { dirname, join } from 'path'

/**
 * Carries a user's data across the product rename ("Hive Desktop" → "Hive").
 *
 * Electron derives `userData` from `app.name`, so renaming the product moves
 * the directory out from under everything that lives in it — the config
 * store, chat history, the second-brain vault ledger, downloaded Whisper
 * models, staged updates. Without this the app would start up looking
 * factory-fresh and the old folder would sit on disk forever, which is a
 * worse outcome than the rename is worth.
 *
 * The move is by `rename`, not a copy: same parent directory, so it's atomic
 * and instant regardless of how large the vault has grown, and a half-moved
 * state is impossible.
 */

/** What a migration attempt did, for the startup log and for tests. */
export type MigrationResult =
  | { moved: false; reason: 'no-legacy' | 'already-populated' }
  | { moved: true; from: string; entries: number }

/** The names `userData` has had, oldest first. Additive: never remove one. */
export const LEGACY_USER_DATA_NAMES = ['hive-desktop', 'Hive Desktop']

/**
 * Moves a legacy `userData` directory onto `current`, if one is there and
 * `current` isn't already in use.
 *
 * "Already in use" is judged by whether `current` holds anything at all, not
 * by looking for a particular file: Electron creates `userData` and drops
 * Chromium's own caches in it before this ever runs, so the check is made
 * against a caller-supplied list of names to ignore. A directory holding
 * only those is a fresh install with the browser's litter in it, and is safe
 * to migrate onto.
 *
 * Deliberately synchronous, and called before the first store is
 * constructed: every store reads its file eagerly, so there is no safe
 * moment to do this concurrently with them.
 */
export function migrateUserData(
  current: string,
  options: { ignore?: readonly string[] } = {}
): MigrationResult {
  const ignore = new Set(options.ignore ?? CHROMIUM_LITTER)
  const legacy = LEGACY_USER_DATA_NAMES.map((name) => join(dirname(current), name)).find(
    (candidate) => candidate !== current && existsSync(candidate)
  )
  if (legacy === undefined) return { moved: false, reason: 'no-legacy' }

  const occupied = existsSync(current)
    ? readdirSync(current).filter((entry) => !ignore.has(entry))
    : []
  if (occupied.length > 0) return { moved: false, reason: 'already-populated' }

  const entries = readdirSync(legacy)
  mkdirSync(current, { recursive: true })
  for (const entry of entries) {
    const target = join(current, entry)
    // Never overwrite: anything already at the target is the newer copy
    // (Chromium wrote it in this run), and losing it is worse than leaving
    // one stale file behind in the legacy directory.
    if (existsSync(target)) continue
    renameSync(join(legacy, entry), target)
  }
  // Best-effort: a leftover file (the skip above, or a lock Chromium still
  // holds) leaves the directory behind rather than failing the launch.
  try {
    rmdirSync(legacy)
  } catch {
    /* the directory wasn't empty — harmless */
  }
  return { moved: true, from: legacy, entries: entries.length }
}

/**
 * Files Chromium writes into `userData` before any of our code runs. A
 * directory containing only these has never been used by the app itself.
 */
const CHROMIUM_LITTER: readonly string[] = [
  'Cache',
  'Code Cache',
  'Crashpad',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Dictionaries',
  'GPUCache',
  'Local Storage',
  'Network',
  'Partitions',
  'Session Storage',
  'Shared Dictionary',
  'blob_storage',
  'Cookies',
  'Cookies-journal',
  'DIPS',
  'DIPS-wal',
  'Network Persistent State',
  'Preferences',
  'SharedStorage',
  'TransportSecurity',
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket'
]
