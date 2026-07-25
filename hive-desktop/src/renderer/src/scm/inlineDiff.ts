import type { GitDiff } from './gitStatus'

/**
 * Pure overlay model for the Cursor-tier inline editor diff (Agent Change
 * Review, ACR-R2.1, design.md §6.2). Maps a parsed `GitDiff` (pre-turn → now)
 * plus the open file's current lines into an interleaved render model — the
 * agent's added lines (green) anchored in place, its removed lines (struck/red)
 * shown as phantom rows just above — plus hunk-navigation (prev/next) state.
 * Kept pure so the interleave/anchor math is unit-testable off the DOM;
 * `InlineAgentDiff` (T14) renders it over the editor gutter.
 */

export type InlineRowType = 'context' | 'add' | 'del'

/** One rendered inline row. `lineNo` is the current-file line (context/add); `null` for a removed (phantom) row. */
export interface InlineRow {
  type: InlineRowType
  text: string
  lineNo: number | null
  /** The hunk this row belongs to (for nav highlighting), or `null` for untouched file context. */
  hunkIndex: number | null
}

export interface InlineModel {
  rows: InlineRow[]
  /** The current-file line each hunk scrolls to (its first changed line), in hunk order — the prev/next targets. */
  anchors: number[]
}

/**
 * Interleaves the file's untouched lines with each hunk's typed lines. Between
 * hunks, the current file supplies the context; inside a hunk, its parsed lines
 * (add/del/ctx) drive the rows so removed lines surface as phantom rows. Hunks
 * are consumed in `newStart` order.
 */
export function buildInlineModel(diff: GitDiff, fileLines: string[]): InlineModel {
  const rows: InlineRow[] = []
  const anchors: number[] = []
  const hunks = diff.hunks.map((h, i) => ({ h, i })).sort((a, b) => a.h.newStart - b.h.newStart)

  let fileIdx = 0 // 0-based cursor into fileLines

  for (const { h, i } of hunks) {
    // Untouched context between the previous position and this hunk's start.
    while (fileIdx < h.newStart - 1 && fileIdx < fileLines.length) {
      rows.push({ type: 'context', text: fileLines[fileIdx], lineNo: fileIdx + 1, hunkIndex: null })
      fileIdx++
    }

    // Anchor on the hunk's first *added* line (where the change lands in the
    // current file); fall back to newStart for a pure-deletion hunk.
    let anchor: number | null = null
    for (const line of h.lines) {
      if (line.type === 'del') {
        rows.push({ type: 'del', text: line.text, lineNo: null, hunkIndex: i })
      } else {
        const type: InlineRowType = line.type === 'add' ? 'add' : 'context'
        rows.push({ type, text: line.text, lineNo: line.newNo, hunkIndex: i })
        if (line.type === 'add' && anchor === null) anchor = line.newNo
        // Advance the file cursor past this consumed new line.
        if (line.newNo !== null) fileIdx = line.newNo
      }
    }
    anchors.push(anchor ?? h.newStart)
  }

  // Trailing untouched context.
  while (fileIdx < fileLines.length) {
    rows.push({ type: 'context', text: fileLines[fileIdx], lineNo: fileIdx + 1, hunkIndex: null })
    fileIdx++
  }

  return { rows, anchors }
}

/**
 * The next/previous hunk index with wraparound (ACR-R2.1 `‹ n de m ›`). Returns
 * 0 when there are no hunks so callers can treat it uniformly.
 */
export function stepHunk(current: number, total: number, dir: 'next' | 'prev'): number {
  if (total <= 0) return 0
  return dir === 'next' ? (current + 1) % total : (current - 1 + total) % total
}
