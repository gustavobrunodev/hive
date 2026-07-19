import type { DragEvent } from 'react'

/**
 * Custom drag MIME for workspace files dragged out of the explorer tree
 * (chat-attachments): lets the chat composer accept a tree row as a context
 * file. Namespaced like `PANE_DRAG_MIME` so it can never be mistaken for a
 * pane move, the tree's own `text/plain` row drags, or an OS file import.
 * Payload: a JSON array of workspace-relative POSIX file paths (files only —
 * the drag source filters directories out).
 */
export const WORKSPACE_FILE_DRAG_MIME = 'application/x-hive-workspace-file'

/** Writes the payload onto a dragstart's dataTransfer. No-op for an empty list (e.g. a directories-only selection). */
export function setWorkspaceFileDrag(event: DragEvent, paths: string[]): void {
  if (paths.length === 0) return
  try {
    event.dataTransfer.setData(WORKSPACE_FILE_DRAG_MIME, JSON.stringify(paths))
  } catch {
    // jsdom / some browsers can throw on setData in odd states — the drag
    // then simply isn't droppable on the composer; tree moves still work.
  }
}

/** True when the in-flight drag carries workspace files (checkable during dragover, when data itself is unreadable). */
export function isWorkspaceFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes(WORKSPACE_FILE_DRAG_MIME) ?? false
}

/** Reads the payload back on drop. Defensive: a malformed payload reads as no files. */
export function readWorkspaceFileDrag(event: DragEvent): string[] {
  try {
    const parsed: unknown = JSON.parse(event.dataTransfer.getData(WORKSPACE_FILE_DRAG_MIME))
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}
