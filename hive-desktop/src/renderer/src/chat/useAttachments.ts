import { useCallback, useRef, useState, type DragEvent } from 'react'
import { isWorkspaceFileDrag, readWorkspaceFileDrag } from '../ui/workspaceFileDnd'

/**
 * One pending composer attachment. `external` entries come from the native
 * picker / OS drag (`path` is absolute, `size` known); `workspace` entries
 * are explorer-tree rows dropped onto the composer (`path` is
 * workspace-relative, `size` unknown/0 — the chip shows the parent folder
 * instead). Mirrors `main/agentAdapter.ts`'s `AttachmentPick` plus `kind`
 * (renderer files mirror main types instead of importing across the boundary).
 */
export interface AttachmentEntry {
  path: string
  name: string
  size: number
  kind: 'external' | 'workspace'
}

function basenameOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

export interface AttachmentsApi {
  items: AttachmentEntry[]
  /** Opens the native multi-file picker and merges the result (deduped by path). */
  pick: () => Promise<void>
  removeAt: (index: number) => void
  clear: () => void
  /** A files drag is hovering the composer — drives the drop overlay. */
  dragActive: boolean
  /** Spread onto the composer wrapper. No-ops when `enabled` is false. */
  dragHandlers: {
    onDragEnter: (event: DragEvent<HTMLElement>) => void
    onDragOver: (event: DragEvent<HTMLElement>) => void
    onDragLeave: (event: DragEvent<HTMLElement>) => void
    onDrop: (event: DragEvent<HTMLElement>) => void
  }
}

/** True for the drags the composer accepts: OS files or explorer-tree workspace files. */
function isAcceptedDrag(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files') || isWorkspaceFileDrag(event)
}

/**
 * Composer attachment state (chat-attachments R6.5/T16): the pending files
 * the next sent message will carry as context. Two entry points — the native
 * picker (attach button) and OS drag-and-drop onto the composer (resolved to
 * absolute paths via `fs.pathForFile`, the sandbox-safe route, same as the
 * explorer's FM-R5 import). Extracted from `Chat` as a hook so the component
 * stays under the complexity budget.
 */
export function useAttachments(enabled: boolean, workspace: string): AttachmentsApi {
  const [items, setItems] = useState<AttachmentEntry[]>([])
  const [dragActive, setDragActive] = useState(false)
  // Enter/leave fire per descendant element — a counter (not a boolean)
  // keeps the overlay steady while the drag crosses inner nodes.
  const dragDepthRef = useRef(0)

  const merge = useCallback((incoming: AttachmentEntry[]) => {
    if (incoming.length === 0) return
    setItems((current) => {
      const known = new Set(current.map((entry) => entry.path))
      const added = incoming.filter((entry) => !known.has(entry.path))
      return added.length === 0 ? current : [...current, ...added]
    })
  }, [])

  const pick = useCallback(async () => {
    if (!enabled) return
    // The picker opens inside the active workspace — where the files worth
    // attaching as context almost always live.
    const picked = await window.hive.agent.chooseAttachments(workspace)
    merge(picked.map((entry) => ({ ...entry, kind: 'external' as const })))
  }, [enabled, workspace, merge])

  const removeAt = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => {
    setItems([])
    dragDepthRef.current = 0
    setDragActive(false)
  }, [])

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !isAcceptedDrag(event)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setDragActive(true)
    },
    [enabled]
  )

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !isAcceptedDrag(event)) return
      // Required for the drop event to fire at all. `copy` keeps the cursor
      // honest for tree rows: dropping here references the file, never moves
      // it out of the workspace.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [enabled]
  )

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !isAcceptedDrag(event)) return
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragActive(false)
    },
    [enabled]
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !isAcceptedDrag(event)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setDragActive(false)
      const dropped: AttachmentEntry[] = []
      if (isWorkspaceFileDrag(event)) {
        for (const path of readWorkspaceFileDrag(event)) {
          dropped.push({ path, name: basenameOf(path), size: 0, kind: 'workspace' })
        }
      } else {
        for (const file of Array.from(event.dataTransfer.files)) {
          const path = window.hive.fs.pathForFile(file)
          if (path !== '')
            dropped.push({ path, name: file.name, size: file.size, kind: 'external' })
        }
      }
      merge(dropped)
    },
    [enabled, merge]
  )

  return {
    items,
    pick,
    removeAt,
    clear,
    dragActive,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop }
  }
}
