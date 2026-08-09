import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { StudioSession } from './types'

/**
 * Design Studio (M18) — the persisted session (spec.md P2).
 *
 * One JSON per session, keyed by `(specPathHash, workspaceHash)` (AD-7): the
 * command log per screen, the transcript per screen, and the active screen.
 * Nothing else — viewport preset, selection, zoom, focus mode and drawer
 * state are deliberately outside the document *and* outside persistence, so
 * reopening a spec restores what the user built, not where they happened to
 * be looking.
 *
 * Same philosophy as `chatHistoryStore.ts`, and for the same reasons:
 *   - `baseDir` is injected (no `electron` import) — the app passes
 *     `app.getPath('userData')`, tests pass a temp dir.
 *   - It lives in the per-user data dir, never in the workspace. DS-R P2 AC-4
 *     is absolute: the Studio writes nothing into the user's project and the
 *     UX Spec is read-only. A prototyping tool that silently drops JSON into
 *     someone's repo is a tool they stop trusting.
 *   - Disk is the single source of truth (no in-memory cache), writes are
 *     write-to-temp-then-rename, and a corrupt/foreign file reads as `null`
 *     rather than throwing — a damaged session must open as a fresh one, not
 *     take the tab down (AC-3).
 */

const SESSION_DIR_NAME = 'design-studio'

/**
 * Session keys are only ever the ones `key()` minted, but they round-trip
 * through the renderer — so validate the shape before using one in a path.
 * Anything else (traversal attempts, garbage) resolves to no session.
 */
const SESSION_KEY_PATTERN = /^[0-9a-f]{16}-[0-9a-f]{16}$/

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export interface StudioSessionStore {
  /** The `(specPathHash, workspaceHash)` disk key. Deterministic: the same pair always reopens the same session. */
  key(specPath: string, workspace: string): string
  /** The stored session, or `null` for an unknown key, an unreadable file or corrupt JSON — all of which mean "start fresh". */
  get(key: string): StudioSession | null
  /** Persists the session atomically. Unknown-shaped keys are a no-op rather than a path escape. */
  save(key: string, session: StudioSession): void
}

/** Structural sanity check — enough to reject foreign/corrupt JSON without a schema library. */
function isStudioSession(value: unknown): value is StudioSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<StudioSession>
  return (
    typeof session.specPath === 'string' &&
    typeof session.workspace === 'string' &&
    typeof session.dsId === 'string' &&
    (session.activeScreenId === null || typeof session.activeScreenId === 'string') &&
    Array.isArray(session.screens)
  )
}

export function createStudioSessionStore(baseDir: string): StudioSessionStore {
  function sessionPath(key: string): string | null {
    if (!SESSION_KEY_PATTERN.test(key)) return null
    return join(baseDir, SESSION_DIR_NAME, `${key}.json`)
  }

  return {
    key(specPath: string, workspace: string): string {
      return `${shortHash(specPath)}-${shortHash(workspace)}`
    },

    get(key: string): StudioSession | null {
      const filePath = sessionPath(key)
      if (!filePath || !existsSync(filePath)) return null
      try {
        const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
        return isStudioSession(parsed) ? parsed : null
      } catch {
        // Corrupt JSON, an unreadable file, a half-written crash artifact:
        // all of them open as a fresh session (AC-3).
        return null
      }
    },

    save(key: string, session: StudioSession): void {
      const finalPath = sessionPath(key)
      if (!finalPath) return
      mkdirSync(join(baseDir, SESSION_DIR_NAME), { recursive: true })
      const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`
      writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8')
      try {
        renameSync(tmpPath, finalPath)
      } catch (err) {
        try {
          unlinkSync(tmpPath)
        } catch {
          // best-effort cleanup
        }
        throw err
      }
    }
  }
}
