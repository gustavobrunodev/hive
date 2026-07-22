/**
 * Shared renderer-side update-flow types + reducer (npm-distribution T11),
 * split out of `UpdateNotice.tsx` itself: `react-refresh/only-export-
 * components` (this repo's Vite Fast Refresh lint rule) forbids a component
 * file from also exporting a plain function, so the pure event -> state
 * mapping lives here instead — a happy accident, since `UpdateCenter` (T13)
 * needs the exact same mapping ("the same state machine as the notice,
 * roomier," design.md §5 Tier 3) and can import it from here too instead of
 * duplicating the switch.
 *
 * Structural mirror of `main/updateService.ts`'s `UpdateEvent`/renderer-side
 * state — kept in lockstep by hand since renderer code doesn't import
 * `main/` types directly (the established convention here; see the previous
 * `AppSettingsSheet.tsx`'s own note on this). Unlike that file's mirror, this
 * one lists every real variant with its real fields (nothing folded into
 * another) — `verifying`/`applying` get their own dedicated presentation now
 * instead of borrowing `checking`'s.
 */
export type UpdateEventIn =
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; bytes: number | null; notes: string | null }
  | { type: 'progress'; percent: number; transferred: number; total: number }
  | { type: 'verifying' }
  | { type: 'downloaded'; version: string; installerPath: string }
  | { type: 'applying' }
  | { type: 'error'; message: string; kind: 'network' | 'integrity' | 'apply' }

/** The update flow's renderer-side state machine (ND-R6.3's ten named states, minus `unsupported` — a static `AppInfo` fact the version-block states never need to know about). */
export type UpdateFlowState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate' }
  | { status: 'available'; version: string; bytes: number | null; notes: string | null }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'verifying' }
  | { status: 'downloaded'; version: string; installerPath: string }
  | { status: 'applying' }
  | { status: 'error'; message: string; kind: 'network' | 'integrity' | 'apply' }

/** One event -> the state it produces. Exhaustive by construction (TS flags a missing case if `UpdateEventIn` ever grows). */
export function reduceUpdateEvent(event: UpdateEventIn): UpdateFlowState {
  switch (event.type) {
    case 'checking':
      return { status: 'checking' }
    case 'not-available':
      return { status: 'upToDate' }
    case 'available':
      return { status: 'available', version: event.version, bytes: event.bytes, notes: event.notes }
    case 'progress':
      return {
        status: 'downloading',
        percent: event.percent,
        transferred: event.transferred,
        total: event.total
      }
    case 'verifying':
      return { status: 'verifying' }
    case 'downloaded':
      return { status: 'downloaded', version: event.version, installerPath: event.installerPath }
    case 'applying':
      return { status: 'applying' }
    case 'error':
      return { status: 'error', message: event.message, kind: event.kind }
  }
}
