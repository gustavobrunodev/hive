import type { DragEvent } from 'react'

/**
 * Custom drag MIME for pane moves (customizable-layout) — namespaced so a
 * pane drag can never be mistaken for the file tree's own row drags
 * (`text/plain`) or an OS file import. Set on dragstart by `WorkUI`; checked
 * by any handler that must ignore pane drags (e.g. the tree's
 * drop-into-folder logic). Lives outside PaneHeader.tsx so component files
 * only export components (react-refresh constraint).
 */
export const PANE_DRAG_MIME = 'application/x-hive-pane'

/** True when the in-flight drag is a pane move (checkable during dragover, when data itself is unreadable). `types` is double-guarded: jsdom fires synthetic drag events whose dataTransfer has no `types` at all. */
export function isPaneDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes(PANE_DRAG_MIME) ?? false
}
