import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { watchWorkspaceShared } from '../workspaceWatch'
import { createPathOracle, type PathOracle } from './filePaths'

/**
 * The live list of workspace files, as the oracle that decides which paths in
 * an agent's reply become openable links (`filePaths.ts`).
 *
 * ## Why it has to be live
 *
 * The interesting case is the one the feature exists for: the agent **just
 * created** the file it is naming. A list loaded when the pane mounted does not
 * contain it, so the one path the user most wants to click is the one that
 * stays dead text. So this subscribes to the workspace watcher — through
 * `watchWorkspaceShared`, never the raw bridge, because the main process keeps
 * exactly one watcher per window and a second raw subscription steals it from
 * whoever had it (see that module's header).
 *
 * Refreshes are **debounced and trailing**. A single agent turn can touch
 * dozens of files, and each one is an fs event; re-listing per event would put
 * a full directory walk behind every keystroke of a write.
 */

/** How long the watcher stays quiet before a burst of writes costs one re-list. */
const REFRESH_DEBOUNCE_MS = 400

export function useWorkspaceFiles(workspace: string): PathOracle {
  const [files, setFiles] = useState<readonly string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(() => {
    // Always asynchronous, the no-workspace case included: a synchronous
    // setState from an effect is a cascading render, and an empty list is a
    // perfectly good thing to resolve with.
    const pending: Promise<readonly string[]> =
      workspace === '' ? Promise.resolve([]) : window.hive.listFiles(workspace)
    pending.then((list) => setFiles(list)).catch(() => setFiles([]))
  }, [workspace])

  useEffect(() => {
    load()
    // Nothing to watch, and nothing the watcher could report.
    if (workspace === '') return undefined
    const unwatch = watchWorkspaceShared(workspace, () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(load, REFRESH_DEBOUNCE_MS)
    })
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      unwatch()
    }
  }, [workspace, load])

  return useMemo(() => createPathOracle(workspace, files), [workspace, files])
}
