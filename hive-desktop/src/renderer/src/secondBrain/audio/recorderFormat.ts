/**
 * `mm:ss` from a whole-second count, for the recorder's elapsed timer.
 *
 * Its own module because a `.tsx` exporting a non-component trips
 * `react-refresh/only-export-components` (the `gitStatus.ts` precedent).
 */
export function formatElapsed(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
