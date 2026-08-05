/** One filesystem change as the bridge reports it (mirrored from `window.hive`, never imported from `src/main/*`). */
type FsChange = Parameters<Parameters<Window['hive']['watchWorkspace']>[1]>[0]
type Listener = (event: FsChange) => void

/**
 * Live subscriptions per watched root, and the bridge unsubscribe backing each.
 * Module scope on purpose: the *main process* keeps exactly one watcher per
 * renderer window (`fs:watch:start` tears down the previous one, `fs:watch:stop`
 * takes no argument), so several independent `window.hive.watchWorkspace` calls
 * are not independent at all — the last subscriber's start wins, and the FIRST
 * unmount stops the watcher for everyone else.
 *
 * That is not hypothetical: the sidebar unmounts the Explorer when the user
 * switches to Source Control / Second Brain, which used to silently kill the
 * git store's and the Second Brain store's fs refreshes for the rest of the
 * session (the "the base exists on disk but Hive still says it doesn't" bug).
 *
 * So the renderer multiplexes: one bridge subscription per root, fanned out to
 * every listener, torn down only when the last of them leaves.
 */
const listeners = new Map<string, Set<Listener>>()
const stops = new Map<string, () => void>()

/**
 * Subscribes to workspace filesystem changes under `root`; returns an
 * unsubscribe. Drop-in replacement for `window.hive.watchWorkspace` — use this
 * everywhere in the renderer instead of the raw bridge call.
 */
export function watchWorkspaceShared(root: string, onChange: Listener): () => void {
  let group = listeners.get(root)
  if (!group) {
    group = new Set<Listener>()
    listeners.set(root, group)
    stops.set(
      root,
      window.hive.watchWorkspace(root, (event) => {
        // Copied before iterating: a listener may unsubscribe on the event.
        for (const listener of [...(listeners.get(root) ?? [])]) listener(event)
      })
    )
  }
  group.add(onChange)

  return () => {
    const current = listeners.get(root)
    if (!current?.delete(onChange) || current.size > 0) return
    listeners.delete(root)
    stops.get(root)?.()
    stops.delete(root)
  }
}
