/**
 * Pure parsing of git conflict markers (git-management GIT-R9). Splits a
 * conflicted file into ordered segments — plain text and conflict blocks — and
 * reassembles it once each block is resolved. Kept pure so the block logic is
 * unit-testable without the DOM or a store. Handles both 2-way
 * (`<<<<<<< / ======= / >>>>>>>`) and diff3 (`||||||| base`) markers; the base
 * section is discarded (P1 accepts ours/theirs/both, not a 3-way merge editor).
 */

/** How the user chose to resolve one conflict block (matches the service's choices). */
export type ConflictChoice = 'current' | 'incoming' | 'both'

/** One segment of a conflicted file. */
export type ConflictSegment =
  | { type: 'text'; lines: string[] }
  | { type: 'conflict'; id: number; ours: string[]; theirs: string[] }

const OURS = /^<{7}(\s|$)/
const BASE = /^\|{7}(\s|$)/
const SEP = /^={7}(\s|$)/
const THEIRS = /^>{7}(\s|$)/

/** Does the file contain any unresolved conflict markers? */
export function hasConflictMarkers(content: string): boolean {
  return content.split('\n').some((line) => OURS.test(line))
}

/** Splits a conflicted file into text + conflict-block segments (GIT-R9.2). */
export function parseConflicts(content: string): ConflictSegment[] {
  const lines = content.split('\n')
  const segments: ConflictSegment[] = []
  let text: string[] = []
  let id = 0

  const flushText = (): void => {
    if (text.length > 0) {
      segments.push({ type: 'text', lines: text })
      text = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (!OURS.test(lines[i])) {
      text.push(lines[i])
      continue
    }
    // Start of a conflict block.
    flushText()
    const ours: string[] = []
    const theirs: string[] = []
    i++
    while (i < lines.length && !SEP.test(lines[i]) && !BASE.test(lines[i])) {
      ours.push(lines[i])
      i++
    }
    // Skip an optional diff3 base section (||||||| … =======).
    if (i < lines.length && BASE.test(lines[i])) {
      i++
      while (i < lines.length && !SEP.test(lines[i])) i++
    }
    // At the ======= separator; collect theirs until >>>>>>>.
    i++
    while (i < lines.length && !THEIRS.test(lines[i])) {
      theirs.push(lines[i])
      i++
    }
    // `i` now sits on the >>>>>>> line (consumed by the loop's i++).
    segments.push({ type: 'conflict', id: id++, ours, theirs })
  }

  flushText()
  return segments
}

/** The number of conflict blocks in a parsed file. */
export function conflictCount(segments: ConflictSegment[]): number {
  return segments.filter((s) => s.type === 'conflict').length
}

/**
 * Rebuilds the file with each conflict block replaced by the chosen side
 * (GIT-R9.2). Every block must have a choice in `resolutions`; call only once
 * all blocks are resolved (the "Marcar resolvido" gate).
 */
export function applyResolutions(
  segments: ConflictSegment[],
  resolutions: Map<number, ConflictChoice>
): string {
  const out: string[] = []
  for (const segment of segments) {
    if (segment.type === 'text') {
      out.push(...segment.lines)
      continue
    }
    const choice = resolutions.get(segment.id)
    if (choice === 'current') out.push(...segment.ours)
    else if (choice === 'incoming') out.push(...segment.theirs)
    else out.push(...segment.ours, ...segment.theirs)
  }
  return out.join('\n')
}
