import { useCallback, useEffect, useState } from 'react'
import { mergeEntry, type GitCommandEntry } from './gitLogs'

export interface GitLogStore {
  entries: GitCommandEntry[]
  /** True until the first history read settles. */
  loading: boolean
  /** Drops the journal in main as well as here — the console's "Limpar". */
  clear: () => void
}

/**
 * The git console's store: main's backlog on mount, a live tail after it.
 *
 * **Subscribed before the history read, not after.** The two are separate IPC
 * calls, and a command that finishes between them would otherwise fall in the
 * gap — invisible in the history because it had not happened yet, and missed
 * by the stream because nobody was listening. Subscribing first turns that gap
 * into an overlap instead, which `mergeEntry` de-duplicates by id.
 *
 * **Mounted with the console, not with the app.** Unlike the MCP store — whose
 * ambient status cluster keeps reading while its dock is closed — nothing here
 * reports anything when the console is shut, so an always-on subscription
 * would be a channel kept open to feed a buffer nobody reads. Main keeps the
 * journal either way, which is what makes opening the console late still show
 * the command being investigated.
 */
export function useGitLogs(): GitLogStore {
  const [entries, setEntries] = useState<GitCommandEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const off = window.hive.git.logs.onEntry((entry) => {
      if (cancelled) return
      setEntries((current) => mergeEntry(current, entry))
    })
    // Named-and-invoked (the repo's `load()` pattern) so the state write is not
    // a bare synchronous setState in the effect body.
    async function load(): Promise<void> {
      const history = await window.hive.git.logs.history()
      if (cancelled) return
      // The history is the *older* half by definition, so it goes in front of
      // whatever the subscription has already delivered — appending it would
      // put yesterday's commands after this second's.
      setEntries((current) =>
        history
          .reduce((acc, entry) => mergeEntry(acc, entry), [] as GitCommandEntry[])
          .concat(current.filter((live) => !history.some((old) => old.id === live.id)))
      )
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const clear = useCallback(() => {
    void window.hive.git.logs.clear().then(() => setEntries([]))
  }, [])

  return { entries, loading, clear }
}
