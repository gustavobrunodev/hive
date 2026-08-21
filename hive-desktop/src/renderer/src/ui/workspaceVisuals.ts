import type { WorkspaceInfo } from './useWorkspaces'

/**
 * Per-workspace visual identity (multi-workspace) — the same job
 * `agentVisuals.ts` and `roleVisuals.ts` do for their own subjects, and kept
 * in a non-component module for the same reason: a file that exports both a
 * component and shared functions breaks Fast Refresh.
 *
 * With one workspace, a folder icon and a name were enough. With a list of
 * them the eye needs something to recognise *before* it reads, so every
 * workspace gets a monogram in a hue derived from its path. Deterministic, so
 * the same folder wears the same colour on every machine and after every
 * restart, and free of configuration: nothing to pick, nothing to store.
 *
 * The hues are the app's existing `--wb-ic-*` recognition palette
 * (workbench.css), not a new set — one vocabulary, and all three themes
 * already resolve it at the contrast floors the e2e sweep gates.
 */

/** The nine hues, in the order the palette declares them. */
const HUES = ['blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'violet'] as const

export type WorkspaceHue = (typeof HUES)[number]

/**
 * Picks a stable hue for a path (FNV-1a, 32-bit). Trailing separators and
 * letter case are normalized away first, so `/work/api/` and `/work/API`
 * are the same place wearing the same colour.
 */
export function workspaceHue(path: string): WorkspaceHue {
  const key = path.replace(/[\\/]+$/, '').toLowerCase()
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return HUES[(hash >>> 0) % HUES.length]
}

/**
 * One or two letters for the tile: the initial of the first word, plus the
 * initial of the next word that carries meaning (`api-gateway` → `AG`,
 * `hive` → `H`).
 *
 * Words of one or two letters are skipped when looking for that second
 * initial, so "Spike de pagamentos" comes out `SP` and not `SD` — a monogram
 * built from a preposition identifies nothing, and Portuguese names are full
 * of them. If every remaining word is that short, the first initial stands
 * alone rather than borrowing one.
 *
 * Spread rather than indexed so an emoji or an accented letter outside the BMP
 * isn't sliced in half.
 */
export function workspaceMonogram(name: string): string {
  // `filter(Boolean)` guarantees every surviving word has a first character,
  // so neither spread below needs a fallback.
  const words = name.split(/[\s._\-–—]+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = [...words[0]][0]
  const second = words.slice(1).find((word) => [...word].length > 2)
  return (first + (second ? [...second][0] : '')).toUpperCase()
}

/**
 * What a workspace's row says about itself. Four states, and only two of them
 * are anomalies:
 *
 *  - `managed` — BMAD is installed here. Marked in the app's accent, because
 *    that is the app's own thing being present, not a "good" value.
 *  - `light`   — a deliberate choice, so it is drawn in the neutral ink. A
 *    green tick here would frame the other option as a defect, which is
 *    exactly the framing this feature exists to avoid.
 *  - `pending` — flagged as managed but with no `_bmad/` on disk: an
 *    interrupted or failed install. A genuine anomaly → `--warning`.
 *  - `missing` — the folder is gone → `--danger`.
 */
export type WorkspaceState = 'managed' | 'light' | 'pending' | 'missing'

export function workspaceState(entry: WorkspaceInfo): WorkspaceState {
  if (entry.missing) return 'missing'
  if (entry.kind === 'light') return 'light'
  return entry.provisioned ? 'managed' : 'pending'
}
