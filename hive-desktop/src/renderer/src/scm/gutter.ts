/**
 * Pure per-line change computation for the editor gutter (git-management
 * §6.4, GIT-R11.2). Diffs a committed baseline against the live draft and
 * classifies each draft line as added / modified / a deletion boundary. Kept
 * pure so the LCS/classification is unit-testable off the keystroke path; the
 * `FileViewer` runs it debounced against the HEAD baseline (`git.fileAtHead`)
 * so typing stays smooth without shelling out to git.
 */

/** The gutter mark for one draft line. `deleted` = lines were removed just above this line. */
export type GutterMark = 'add' | 'modified' | 'deleted' | null

/** Above this line count the gutter is skipped (a generated/huge file), per the design's cap. */
const MAX_GUTTER_LINES = 5000

/** Ordered edit ops between baseline (`a`) and draft (`b`) line arrays. */
type EditOp = 'eq' | 'ins' | 'del'

/** Longest-common-subsequence edit script over lines (`del` = a baseline line, `ins` = a draft line). */
function lineOps(a: string[], b: string[]): EditOp[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: EditOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push('eq')
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push('del')
      i++
    } else {
      ops.push('ins')
      j++
    }
  }
  while (i < n) {
    ops.push('del')
    i++
  }
  while (j < m) {
    ops.push('ins')
    j++
  }
  return ops
}

/**
 * Per-draft-line gutter marks for `draft` vs `baseline` (GIT-R11.2). An
 * inserted line adjacent to a deletion reads as **modified**; a lone insertion
 * is **added**; a deletion with no matching insertion leaves a **deleted**
 * boundary mark on the following (or last) line. Returns an all-`null` array
 * when either side exceeds the large-file cap.
 */
export function computeGutter(baseline: string, draft: string): GutterMark[] {
  const a = baseline === '' ? [] : baseline.split('\n')
  const b = draft.split('\n')
  const marks: GutterMark[] = new Array<GutterMark>(b.length).fill(null)
  if (a.length > MAX_GUTTER_LINES || b.length > MAX_GUTTER_LINES) return marks
  // A brand-new file (no baseline): every line is added.
  if (a.length === 0) return marks.map(() => 'add')

  const ops = lineOps(a, b)
  let draftIdx = 0
  let pendingDel = 0
  for (const op of ops) {
    if (op === 'eq') {
      if (pendingDel > 0) {
        marks[draftIdx] = 'deleted'
        pendingDel = 0
      }
      draftIdx++
    } else if (op === 'del') {
      pendingDel++
    } else {
      marks[draftIdx] = pendingDel > 0 ? 'modified' : 'add'
      if (pendingDel > 0) pendingDel--
      draftIdx++
    }
  }
  // A deletion at the very end has no following line — mark the last one.
  if (pendingDel > 0 && b.length > 0) marks[b.length - 1] = 'deleted'
  return marks
}

/** Whether any draft line carries a gutter mark (skip rendering the strip otherwise). */
export function hasGutterMarks(marks: GutterMark[]): boolean {
  return marks.some((mark) => mark !== null)
}
