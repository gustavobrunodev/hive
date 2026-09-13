import { useCallback, useEffect, useRef, useState } from 'react'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'

/** What the list is doing right now. `null` sessions + `loading` = first read in flight. */
export type ChatSessionsStatus = 'loading' | 'ready' | 'error'

export interface ChatSessionsStore {
  /** The loaded set, or `null` while the first read is in flight. */
  sessions: ChatSessionMeta[] | null
  status: ChatSessionsStatus
  /** The load timestamp — the render-stable "now" every relative time and bucket derives from. */
  loadedAt: number
  /** Full-text results from main, tagged with the query they answer. */
  ftResults: { query: string; entries: ChatSessionMeta[] } | null
  reload: () => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  /** Deletes a whole selection — one repaint, whatever the count (see `removeMany`). */
  removeMany: (ids: readonly string[]) => void
  /** Drives the debounced full-text search (empty string = local filtering only). */
  setQuery: (query: string) => void
  query: string
  error: 'rename' | 'delete' | 'search' | null
}

export interface UseChatSessionsOptions {
  workspace: string
  /** Reads pause while `false` — the dialog only loads while it is open. */
  active?: boolean
  /** The conversation on screen: deleting it resets the pane to a fresh one. */
  activeSessionId?: string | null
  onNewConversation?: () => void
}

/**
 * The conversation history, as one store.
 *
 * Both surfaces that list conversations — the sidebar section and the "Todas as
 * conversas" dialog — need the same reads (list + debounced full-text search)
 * and the same writes (rename, delete, with the delete-the-open-one coupling).
 * Before the redesign this lived inside the history popover; two copies of it
 * would have been two chances for a rename to update one list and not the other.
 *
 * A **failed read is a state**, not a silent empty list. The old popover's
 * `.catch(() => setSessions([]))` drew the teaching empty state ("Nenhuma
 * conversa ainda") over a disk error, which tells the user their history is gone
 * when it is merely unread.
 */
export function useChatSessions({
  workspace,
  active = true,
  activeSessionId = null,
  onNewConversation
}: UseChatSessionsOptions): ChatSessionsStore {
  const [sessions, setSessions] = useState<ChatSessionMeta[] | null>(null)
  const [status, setStatus] = useState<ChatSessionsStatus>('loading')
  const [loadedAt, setLoadedAt] = useState(0)
  const [query, updateQuery] = useState('')
  const [error, setError] = useState<ChatSessionsStore['error']>(null)
  const [revision, setRevision] = useState(0)
  const listRequest = useRef(0)
  const searchRequest = useRef(0)
  const mounted = useRef(false)
  const scopeVersion = useRef(0)
  const currentConversation = useRef({ activeSessionId, onNewConversation })
  const [ftResults, setFtResults] = useState<{ query: string; entries: ChatSessionMeta[] } | null>(
    null
  )

  useEffect(() => {
    currentConversation.current = { activeSessionId, onNewConversation }
  }, [activeSessionId, onNewConversation])

  const [loadedWorkspace, setLoadedWorkspace] = useState(workspace)
  if (loadedWorkspace !== workspace) {
    setLoadedWorkspace(workspace)
    setSessions(null)
    setFtResults(null)
    updateQuery('')
    setError(null)
    setStatus('loading')
  }
  useEffect(() => {
    mounted.current = true
    scopeVersion.current += 1
    return () => {
      mounted.current = false
      scopeVersion.current += 1
      listRequest.current += 1
      searchRequest.current += 1
    }
  }, [workspace])

  const read = useCallback((): void => {
    const version = scopeVersion.current
    const at = Date.now()
    const request = ++listRequest.current
    window.hive.chatHistory
      .list(workspace)
      .then((list) => {
        if (!mounted.current || version !== scopeVersion.current || request !== listRequest.current)
          return
        setSessions(list)
        setStatus('ready')
        setLoadedAt(at)
        setRevision((value) => value + 1)
      })
      .catch(() => {
        if (!mounted.current || version !== scopeVersion.current || request !== listRequest.current)
          return
        setSessions(null)
        setStatus('error')
        setLoadedAt(at)
      })
  }, [workspace])

  const reload = useCallback((): void => {
    setStatus('loading')
    setError(null)
    read()
  }, [read])

  // The list reloads whenever the surface becomes active — the same lazy
  // pattern the workspace chip's recents use, so it never goes stale while
  // staying subscription-free.
  useEffect(() => {
    if (active) read()
  }, [active, read])

  const setQuery = useCallback((next: string): void => {
    searchRequest.current += 1
    setFtResults(null)
    setError((current) => (current === 'search' ? null : current))
    updateQuery(next)
  }, [])

  // A completed write supersedes any read that began before it. Refresh the
  // active search as well, since a rename can add or remove a title match.
  const didMutate = useCallback((): void => {
    listRequest.current += 1
    searchRequest.current += 1
    setStatus('ready')
    setError(null)
    setRevision((value) => value + 1)
  }, [])

  const rename = useCallback(
    (id: string, title: string): void => {
      const version = scopeVersion.current
      window.hive.chatHistory
        .rename(workspace, id, title)
        .then((meta) => {
          if (!mounted.current || version !== scopeVersion.current) return
          if (!meta) {
            reload()
            return
          }
          didMutate()
          setSessions((current) =>
            current ? current.map((entry) => (entry.id === id ? meta : entry)) : current
          )
          setFtResults((current) =>
            current
              ? {
                  ...current,
                  entries: current.entries.map((entry) =>
                    entry.id === id ? { ...meta, match: entry.match } : entry
                  )
                }
              : current
          )
        })
        .catch(() => {
          if (mounted.current && version === scopeVersion.current) setError('rename')
        })
    },
    [workspace, reload, didMutate]
  )

  const remove = useCallback(
    (id: string): void => {
      const version = scopeVersion.current
      window.hive.chatHistory
        .delete(workspace, id)
        .then(() => {
          if (!mounted.current || version !== scopeVersion.current) return
          didMutate()
          setSessions((current) => (current ? current.filter((entry) => entry.id !== id) : current))
          setFtResults((current) =>
            current
              ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) }
              : current
          )
          // The open transcript belongs to the deleted conversation — reset the
          // pane to a fresh one instead of leaving a ghost transcript.
          const current = currentConversation.current
          if (id === current.activeSessionId) current.onNewConversation?.()
        })
        .catch(() => {
          if (mounted.current && version === scopeVersion.current) setError('delete')
        })
    },
    [workspace, didMutate]
  )

  /**
   * Deletes every id in one go.
   *
   * **Not a loop over `remove`.** Each `remove` repaints the list as its write
   * lands, so deleting six conversations would re-order the rows six times
   * under the user's pointer — and a failure halfway would leave the list
   * showing some of what was asked for with no way to tell which. This waits
   * for every write, then applies one state change: the rows that actually went
   * disappear together, and a partial failure says so *and* keeps the survivors
   * on screen where they can be retried.
   */
  const removeMany = useCallback(
    (ids: readonly string[]): void => {
      if (ids.length === 0) return
      const version = scopeVersion.current
      void Promise.all(
        ids.map((id) =>
          window.hive.chatHistory
            .delete(workspace, id)
            .then(() => id)
            .catch(() => null)
        )
      ).then((results) => {
        if (!mounted.current || version !== scopeVersion.current) return
        const gone = new Set(results.filter((id): id is string => id !== null))
        didMutate()
        if (gone.size < ids.length) setError('delete')
        if (gone.size === 0) return
        setSessions((current) =>
          current ? current.filter((entry) => !gone.has(entry.id)) : current
        )
        setFtResults((current) =>
          current
            ? { ...current, entries: current.entries.filter((entry) => !gone.has(entry.id)) }
            : current
        )
        // Same coupling as the single delete: the open transcript cannot
        // outlive the conversation it belongs to.
        const conversation = currentConversation.current
        if (conversation.activeSessionId !== null && gone.has(conversation.activeSessionId)) {
          conversation.onNewConversation?.()
        }
      })
    },
    [workspace, didMutate]
  )

  // Debounced full-text search — one IPC per settled keystroke burst. The local
  // title/preview filter answers instantly in the meantime, so typing never
  // feels gated on the round trip. A cleared query needs no state reset: stale
  // results are already ignored by the `ftResults.query === query` guard at the
  // call sites.
  useEffect(() => {
    const version = scopeVersion.current
    const trimmed = query.trim()
    if (trimmed === '' || !active) return
    const request = ++searchRequest.current
    const timer = setTimeout(() => {
      window.hive.chatHistory
        .search(workspace, trimmed)
        .then((entries) => {
          if (
            !mounted.current ||
            version !== scopeVersion.current ||
            request !== searchRequest.current
          )
            return
          setFtResults({ query: trimmed, entries })
          setError((current) => (current === 'search' ? null : current))
        })
        .catch(() => {
          if (
            !mounted.current ||
            version !== scopeVersion.current ||
            request !== searchRequest.current
          )
            return
          setFtResults(null)
          setError('search')
        })
    }, 120)
    return () => {
      clearTimeout(timer)
      searchRequest.current += 1
    }
  }, [query, workspace, active, revision])

  return {
    sessions,
    status,
    loadedAt,
    ftResults,
    reload,
    rename,
    remove,
    removeMany,
    query,
    setQuery,
    error
  }
}

/**
 * The rows a query resolves to: the main-process full-text hits once they have
 * caught up with the keystrokes, and the instant local title/preview filter
 * until then.
 */
export function resolveQuery(store: ChatSessionsStore): ChatSessionMeta[] {
  const needle = store.query.trim().toLowerCase()
  const loaded = store.sessions ?? []
  if (needle === '') return loaded
  if (store.ftResults?.query === store.query.trim()) return store.ftResults.entries
  return loaded.filter((meta) =>
    `${sessionTitle(meta)} ${meta.preview}`.toLowerCase().includes(needle)
  )
}
