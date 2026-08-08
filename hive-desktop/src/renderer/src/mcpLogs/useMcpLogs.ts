import { useCallback, useEffect, useRef, useState } from 'react'
import type { McpLogEntry, McpLogSource } from './logConsole'

/**
 * `useMcpLogs` — the console's data layer: history on open, a live tail after
 * it, and a bounded buffer holding both.
 *
 * Two things are worth knowing about the shape:
 *
 * **The buffer is capped and de-duplicated.** `read` and `watch` can overlap by
 * a line or two (the CLI may append between the two calls), and entry ids are
 * `<file>#<line>`, so a `Set` of ids settles it exactly. The cap keeps a
 * long-running session from growing the array without bound; oldest goes
 * first, which matches what a tail is for.
 *
 * **It stays subscribed while the dock is closed.** The dock's collapsed strip
 * reports the last event and the error tally — that ambient "MCP is doing
 * something" signal is most of the point of docking the console instead of
 * hiding it in a dialog, and it can't work if the subscription only exists
 * while the panel is open. The cost is one debounced watcher per window.
 */

/** How many entries the console keeps in memory before dropping the oldest. */
const BUFFER_CAP = 4000

/** How long after the last entry the console still reads as live. */
const LIVE_WINDOW_MS = 20_000

/**
 * How long a just-arrived row stays marked fresh. Long enough to outlast the
 * row's own entrance animation, short enough that scrolling back through
 * history a second later doesn't find rows still highlighted.
 */
const FRESH_WINDOW_MS = 600

export interface McpLogStore {
  entries: McpLogEntry[]
  sources: McpLogSource[]
  /** True until the first history read settles. */
  loading: boolean
  /** A read failure, as a user-facing message. */
  error: string | null
  /** Epoch ms of the most recent entry, or null when nothing has arrived. */
  lastAt: number | null
  /**
   * Ids from the most recent live batch, for ~600ms. Only these rows animate
   * in — history and rows revealed by a filter change appear at rest, so the
   * motion means "this just happened" rather than "the list re-rendered".
   */
  freshIds: ReadonlySet<string>
  /** Re-reads history and the source list from scratch. */
  reload: () => void
}

/** An empty set, shared so an idle console re-renders against a stable value. */
const NO_FRESH: ReadonlySet<string> = new Set()

/** True when `lastAt` is recent enough that the console should show its live pulse. */
export function isLive(lastAt: number | null, now: number): boolean {
  return lastAt !== null && now - lastAt < LIVE_WINDOW_MS
}

/**
 * Merges a batch into the buffer, dropping ids already present and trimming
 * the front to the cap. Exported for its own test — the de-duplication is the
 * part that silently doubles every row when it's wrong.
 */
export function mergeEntries(current: McpLogEntry[], batch: McpLogEntry[]): McpLogEntry[] {
  if (batch.length === 0) return current
  const seen = new Set(current.map((entry) => entry.id))
  const fresh = batch.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
  if (fresh.length === 0) return current
  const merged = [...current, ...fresh].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  return merged.length > BUFFER_CAP ? merged.slice(merged.length - BUFFER_CAP) : merged
}

/**
 * One completed load, tagged with what it was a load *of*. Holding the tag
 * alongside the data is what lets `loading` be derived rather than reset: a
 * workspace switch changes the requested key, which makes the previous load
 * stale in the same render, with no effect firing to clear it. (Resetting
 * state synchronously inside an effect would show one frame of the old
 * workspace's events under the new workspace's name.)
 */
interface LoadedState {
  key: string
  entries: McpLogEntry[]
  sources: McpLogSource[]
  error: string | null
}

export function useMcpLogs(workspace: string): McpLogStore {
  const [reloadToken, setReloadToken] = useState(0)
  const [loaded, setLoaded] = useState<LoadedState | null>(null)
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(NO_FRESH)
  // Lets the watcher notice a server the console has never seen, so the rail
  // and the server filter can pick it up mid-session.
  const knownServers = useRef<Set<string>>(new Set())

  const key = `${reloadToken}:${workspace}`
  const current = loaded !== null && loaded.key === key ? loaded : null

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    knownServers.current = new Set()

    void Promise.all([window.hive.mcpLogs.read(workspace), window.hive.mcpLogs.sources(workspace)])
      .then(([history, sourceList]) => {
        if (cancelled) return
        for (const entry of history) knownServers.current.add(entry.server)
        setLoaded({ key, entries: history, sources: sourceList, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoaded({
          key,
          entries: [],
          sources: [],
          error: err instanceof Error ? err.message : String(err)
        })
      })

    return () => {
      cancelled = true
    }
  }, [workspace, key])

  useEffect(() => {
    if (freshIds.size === 0) return
    const id = setTimeout(() => setFreshIds(NO_FRESH), FRESH_WINDOW_MS)
    return () => clearTimeout(id)
  }, [freshIds])

  useEffect(() => {
    const stop = window.hive.mcpLogs.watch(workspace, (batch) => {
      // Batches that arrive before (or after) this workspace's own load are
      // dropped: `key` pins every merge to the load it belongs to.
      setLoaded((state) =>
        state === null || state.key !== key
          ? state
          : { ...state, entries: mergeEntries(state.entries, batch) }
      )
      setFreshIds(new Set(batch.map((entry) => entry.id)))
      // A brand-new server means a new rail card and a new filter target.
      if (batch.every((entry) => knownServers.current.has(entry.server))) return
      for (const entry of batch) knownServers.current.add(entry.server)
      void window.hive.mcpLogs
        .sources(workspace)
        .then((sourceList) =>
          setLoaded((state) =>
            state === null || state.key !== key ? state : { ...state, sources: sourceList }
          )
        )
        .catch(() => {
          // A failed refresh just leaves the rail as it was; the stream is unaffected.
        })
    })
    return stop
  }, [workspace, key])

  const entries = current?.entries ?? []
  const lastAt = entries.length > 0 ? entries[entries.length - 1].at : null

  return {
    entries,
    sources: current?.sources ?? [],
    loading: current === null,
    error: current?.error ?? null,
    lastAt,
    freshIds,
    reload
  }
}
