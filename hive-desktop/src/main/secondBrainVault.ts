import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Pure filesystem helper for staging raw ingestion material into the vault
 * (design §3). No `electron` import — injectable clock/rng keep it fully
 * deterministic and unit-testable on a temp dir. The vault is git-versioned
 * (D-SB-2), so a `stageRaw` write is a normal workspace write that shows up in
 * the M10 Source Control and M11 review flows for free.
 */
export interface SecondBrainVault {
  /**
   * SB-R3.2: writes `content` to a timestamped Markdown file under the vault's
   * `raw/` inbox (the skill's documented ingestion inbox, D-SB-5) and returns
   * the path relative to the workspace. Refuses empty/whitespace-only content
   * (SB-R3.4 / the "no text" edge case).
   */
  stageRaw(workspace: string, content: string): { relPath: string; absPath: string }
  /**
   * SB-R2.5: number of files currently staged in the vault's `raw/` inbox —
   * drives the activity-bar badge. Best-effort; 0 when the vault/`raw/` is absent.
   */
  countRawPending(workspace: string): number
}

export interface VaultFsDeps {
  now?: () => Date
  /** Random filename suffix — avoids same-second collisions (edge case). */
  rand?: () => string
}

/** The default vault directory name (D-SB-2); staging always targets this. */
const VAULT_DIR = 'second-brain'
const RAW_DIR = 'raw'

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** `20260725-153012` — local time, filename-safe, human-scannable. */
function stamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

export function createSecondBrainVault(deps: VaultFsDeps = {}): SecondBrainVault {
  const now = deps.now ?? (() => new Date())
  const rand = deps.rand ?? (() => Math.random().toString(36).slice(2, 8))

  function stageRaw(workspace: string, content: string): { relPath: string; absPath: string } {
    if (content.trim().length === 0) {
      throw new Error('second-brain: refusing to stage empty content')
    }
    const rawDir = join(workspace, VAULT_DIR, RAW_DIR)
    // The filename is generated (timestamp + random suffix) — no user-controlled
    // path segment, so it can't traverse out of raw/.
    const fileName = `ingest-${stamp(now())}-${rand()}.md`
    const absPath = join(rawDir, fileName)

    mkdirSync(rawDir, { recursive: true })
    writeFileSync(absPath, content, 'utf-8')
    return { relPath: join(VAULT_DIR, RAW_DIR, fileName), absPath }
  }

  function countRawPending(workspace: string): number {
    const rawDir = join(workspace, VAULT_DIR, RAW_DIR)
    if (!existsSync(rawDir)) return 0
    try {
      // `withFileTypes` avoids a per-entry `stat` (one syscall, no race window).
      return readdirSync(rawDir, { withFileTypes: true }).filter((e) => e.isFile()).length
    } catch {
      // `raw` exists but isn't a readable directory (e.g. it's a file) — 0.
      return 0
    }
  }

  return { stageRaw, countRawPending }
}
