import { readdirSync, rmSync, statSync, type Dirent } from 'fs'
import { join } from 'path'
import { LEGACY_WHISPER_MODELS_DIRNAME } from './asrPaths'

/**
 * The Whisper models an upgrading install still has on disk (M29).
 *
 * M29 replaced the engine, and nothing reads these files any more. They are
 * **not deleted by a migration**, and that is the decision worth stating: what
 * is there is a download the user waited twenty minutes for, often several
 * gigabytes of it, and removing it silently on first launch is not a migration
 * — it is a surprise with no undo. The voice panel offers to free the space
 * instead, with the measured figure on the button.
 *
 * Measuring is cheap and bounded: the store's own layout is one directory per
 * model, one level of files inside (plus `onnx/`), so a shallow recursive walk
 * is enough and there is no reason to follow links or descend arbitrarily.
 */

export interface LegacyModels {
  /** Absolute path, whether or not anything is there. */
  dir: string
  /** Total bytes on disk. `0` when the directory is absent or empty. */
  bytes: number
}

/** Bytes under `dir`, or `0` for anything unreadable. Never throws. */
function sizeOf(dir: string): number {
  let total = 0
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      total += sizeOf(full)
      continue
    }
    // `isFile()` rather than `!isDirectory()`: a symlink's target could be
    // anywhere, and counting it would report space that freeing this would not
    // actually return.
    if (!entry.isFile()) continue
    try {
      total += statSync(full).size
    } catch {
      continue
    }
  }
  return total
}

/** What the old Whisper store is costing, if it is still there. */
export function measureLegacyModels(userData: string): LegacyModels {
  const dir = join(userData, LEGACY_WHISPER_MODELS_DIRNAME)
  return { dir, bytes: sizeOf(dir) }
}

/**
 * Deletes the old store. Idempotent, and a no-op when it is already gone.
 *
 * Returns the state afterwards rather than nothing, for the same reason
 * `asr:deleteModel` does: the caller must not have to guess what the delete
 * left behind, and on Windows a file the previous engine had open can survive.
 */
export function removeLegacyModels(userData: string): LegacyModels {
  const { dir } = measureLegacyModels(userData)
  rmSync(dir, { recursive: true, force: true })
  return measureLegacyModels(userData)
}
