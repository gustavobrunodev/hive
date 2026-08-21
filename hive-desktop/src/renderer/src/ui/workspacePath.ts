/**
 * Path formatting for the workspace surfaces (multi-workspace).
 *
 * A workspace row shows its name on one line and where it lives on the next.
 * Full absolute paths are long, and the informative end is the *tail* — so the
 * tail is what survives. Truncation is computed here rather than left to CSS
 * `text-overflow`, which would ellipsize the wrong end, and rather than to the
 * `direction: rtl` trick, which reorders punctuation in ways that vary by
 * platform.
 */

/** Splits on both separators so a Windows path shortens the same way a POSIX one does. */
function segmentsOf(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean)
}

/**
 * The last `maxSegments` segments of `path`, prefixed with an ellipsis when
 * anything was dropped. A path that already fits comes back untouched, keeping
 * its leading separator so it still reads as absolute.
 */
export function shortenPath(path: string, maxSegments = 3): string {
  const segments = segmentsOf(path)
  if (segments.length <= maxSegments) return path
  return `…/${segments.slice(-maxSegments).join('/')}`
}

/**
 * Where a workspace *lives* — its parent directory, shortened.
 *
 * The row already spells the workspace's name on the line above, so repeating
 * the last segment underneath spends the width that disambiguates two folders
 * called `api` on nothing. The first attempt showed the whole path and it lost
 * a fight with `text-overflow`, arriving as `…/dev/work/api-ga…`: ellipsized at
 * both ends, informative at neither. The parent alone fits.
 *
 * A path with no parent (a drive or filesystem root) has nothing to shorten,
 * so it is returned as-is rather than as an empty line.
 */
export function locationOf(path: string, maxSegments = 2): string {
  const segments = segmentsOf(path)
  if (segments.length <= 1) return path
  return shortenPath(`/${segments.slice(0, -1).join('/')}`, maxSegments)
}
