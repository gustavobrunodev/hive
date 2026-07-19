import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'

/**
 * ChatHistoryStore (session-history) — persists chat conversations so users
 * can leave and resume them, Claude-Desktop-style. Lives in the per-user data
 * dir (not the workspace) so transcripts never pollute the user's project or
 * its git history; sessions are keyed by a hash of the workspace path, so
 * each workspace only ever sees its own conversations.
 *
 * Layout on disk: `<baseDir>/chat-history/<workspace-hash>/<sessionId>.json`,
 * one file per session. `list()` reads every file in the workspace's
 * directory — fine at desktop scale (hundreds of sessions of plain text) and
 * it keeps the store index-free: no sidecar index file that could drift from
 * the session files themselves.
 *
 * Same persistence philosophy as `configStore.ts`: `baseDir` is injected (no
 * `electron` import, unit-testable against a temp dir), disk is the single
 * source of truth (no in-memory cache), and writes are
 * write-to-temp-then-rename so a crash mid-write never leaves a half-written
 * session behind. Corrupt/foreign files are skipped by `list()` and read as
 * `null` by `get()` — a damaged transcript must never take the chat down.
 */

/** One persisted chat turn. `at` is epoch ms. */
export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /**
   * Display names of files the user attached to this turn (chat-attachments)
   * — what the transcript's chips re-render on restore. Names only: the
   * files' contents live with the agent turn that already consumed them, and
   * absolute host paths would leak machine layout into a portable transcript.
   * Absent on assistant messages and on files written before this field.
   */
  attachments?: string[]
}

/** A full persisted conversation. `title` auto-derives from the first user message and is user-renameable afterwards. */
export interface StoredChatSession {
  id: string
  workspace: string
  agent: string | null
  title: string
  createdAt: number
  updatedAt: number
  messages: StoredChatMessage[]
  /**
   * The agent CLI's own session id for this conversation (conversation
   * memory): stored after each turn's `session` event and handed back as
   * `--resume` on the next turn, so the agent keeps full context across
   * turns and across app restarts. `null` until the first turn completes
   * (and always `null` on files written before this field existed).
   */
  cliSessionId?: string | null
}

/** The list()/mutation projection: everything the history UI needs, without shipping whole transcripts over IPC per row. */
export interface ChatSessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  agent: string | null
  /** One-line snippet of the last message, for row subtitles. */
  preview: string
  /** `search()` only: a snippet of the message text around the first match (null when the match was in the title). */
  match?: string | null
}

export interface ChatHistoryStore {
  /** All of `workspace`'s sessions, newest-updated first. Unreadable/corrupt files are skipped, never thrown. */
  list(workspace: string): ChatSessionMeta[]
  /** Full transcript for restore; `null` for an unknown id or unreadable file. */
  get(workspace: string, id: string): StoredChatSession | null
  /** Starts (and persists) a new empty session. Callers create lazily — on the first sent message — so no empty shells accumulate. */
  create(workspace: string, agent: string | null): StoredChatSession
  /**
   * Appends one message and bumps `updatedAt`. The first *user* message of an
   * untitled session also becomes its auto-title (Claude-Desktop behavior).
   * Returns the fresh meta, or `null` if the session no longer exists (e.g.
   * deleted from another window mid-turn) — callers treat that as a no-op.
   */
  appendMessage(
    workspace: string,
    id: string,
    message: { role: 'user' | 'assistant'; text: string; attachments?: string[] }
  ): ChatSessionMeta | null
  /** Sets a user-chosen title (overrides the auto-title from then on). Same `null` contract as `appendMessage`. */
  rename(workspace: string, id: string, title: string): ChatSessionMeta | null
  /** Records the CLI-native session id used for `--resume` (conversation memory). No `updatedAt` bump: it's plumbing, not user activity. */
  setCliSession(workspace: string, id: string, cliSessionId: string): void
  /**
   * Full-text search (session-history): matches `query` against titles AND
   * every message's text, case- and accent-insensitively (pt-BR: "financas"
   * finds "finanças"). Message hits carry a `match` snippet around the first
   * occurrence. Empty/whitespace query behaves like `list()`.
   */
  search(workspace: string, query: string): ChatSessionMeta[]
  /** Deletes the session file. Unknown ids are a safe no-op — the end state ("gone") already holds. */
  remove(workspace: string, id: string): void
}

const HISTORY_DIR_NAME = 'chat-history'

/** Auto-title budget — enough to survive a row title at any pane width without storing a paragraph. */
const TITLE_MAX_CHARS = 64

/** Preview snippet budget for `ChatSessionMeta.preview`. */
const PREVIEW_MAX_CHARS = 96

/**
 * Session ids are only ever the UUIDs this store minted, but they round-trip
 * through the renderer — so validate the shape before using one in a file
 * path. Anything else (traversal attempts, garbage) resolves to no session.
 */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Collapses runs of whitespace/newlines so multi-line prompts read as one row line. */
function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Search normalization: lowercase + strip combining accents (U+0300–U+036F after NFD), so "financas" matches "finanças". */
function searchNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Snippet budget around a full-text match. */
const MATCH_CONTEXT_BEFORE = 24
const MATCH_CONTEXT_AFTER = 72

/**
 * One-line snippet of `text` centered on the first occurrence of `needle`
 * (accent/case-insensitive). NFD normalization only *adds* combining marks,
 * so indexing by the normalized position can drift a few chars on accented
 * text — for a preview snippet that's imperceptible, and the window is wide
 * enough that the match always lands inside it.
 */
function matchSnippet(text: string, normalizedNeedle: string): string | null {
  const line = singleLine(text)
  const index = searchNormalize(line).indexOf(normalizedNeedle)
  if (index === -1) return null
  const start = Math.max(0, index - MATCH_CONTEXT_BEFORE)
  const end = Math.min(line.length, index + normalizedNeedle.length + MATCH_CONTEXT_AFTER)
  return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`
}

/** First-user-message → title: one line, cut at a word boundary within budget. */
export function deriveSessionTitle(text: string): string {
  const line = singleLine(text)
  if (line.length <= TITLE_MAX_CHARS) return line
  const cut = line.slice(0, TITLE_MAX_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > TITLE_MAX_CHARS / 2 ? lastSpace : TITLE_MAX_CHARS).trimEnd()}…`
}

function previewOf(messages: StoredChatMessage[]): string {
  const last = messages[messages.length - 1]
  if (!last) return ''
  const line = singleLine(last.text)
  return line.length <= PREVIEW_MAX_CHARS ? line : `${line.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`
}

function metaOf(session: StoredChatSession): ChatSessionMeta {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    agent: session.agent,
    preview: previewOf(session.messages)
  }
}

/** Structural sanity check for a parsed session file — enough to reject foreign/corrupt JSON without a schema library. */
function isStoredSession(value: unknown): value is StoredChatSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<StoredChatSession>
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number' &&
    Array.isArray(session.messages)
  )
}

export function createChatHistoryStore(baseDir: string): ChatHistoryStore {
  /** Workspace paths are arbitrary user paths — hash them into safe, collision-resistant directory names. */
  function workspaceDir(workspace: string): string {
    const hash = createHash('sha256').update(workspace).digest('hex').slice(0, 16)
    return join(baseDir, HISTORY_DIR_NAME, hash)
  }

  function sessionPath(workspace: string, id: string): string | null {
    if (!SESSION_ID_PATTERN.test(id)) return null
    return join(workspaceDir(workspace), `${id}.json`)
  }

  function readSession(filePath: string): StoredChatSession | null {
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
      return isStoredSession(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  /** Same atomic write-to-temp-then-rename as `configStore.writeConfig` — a crash mid-write can't corrupt a transcript. */
  function writeSession(workspace: string, session: StoredChatSession): void {
    const dir = workspaceDir(workspace)
    mkdirSync(dir, { recursive: true })
    const finalPath = join(dir, `${session.id}.json`)
    const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8')
    try {
      renameSync(tmpPath, finalPath)
    } catch (err) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // best-effort cleanup
      }
      throw err
    }
  }

  function list(workspace: string): ChatSessionMeta[] {
    const dir = workspaceDir(workspace)
    if (!existsSync(dir)) return []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return []
    }
    const metas: ChatSessionMeta[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const session = readSession(join(dir, entry))
      if (session) metas.push(metaOf(session))
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function get(workspace: string, id: string): StoredChatSession | null {
    const filePath = sessionPath(workspace, id)
    if (!filePath || !existsSync(filePath)) return null
    return readSession(filePath)
  }

  function create(workspace: string, agent: string | null): StoredChatSession {
    const now = Date.now()
    const session: StoredChatSession = {
      id: randomUUID(),
      workspace,
      agent,
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
      cliSessionId: null
    }
    writeSession(workspace, session)
    return session
  }

  function appendMessage(
    workspace: string,
    id: string,
    message: { role: 'user' | 'assistant'; text: string; attachments?: string[] }
  ): ChatSessionMeta | null {
    const session = get(workspace, id)
    if (!session) return null
    const now = Date.now()
    session.messages.push({
      id: randomUUID(),
      role: message.role,
      text: message.text,
      at: now,
      ...(message.attachments && message.attachments.length > 0
        ? { attachments: message.attachments }
        : {})
    })
    session.updatedAt = now
    if (session.title === '' && message.role === 'user') {
      // An attachments-only turn (empty text) titles by its first file, so
      // the history row never reads as blank.
      session.title = deriveSessionTitle(
        message.text.trim() !== '' ? message.text : (message.attachments?.[0] ?? '')
      )
    }
    writeSession(workspace, session)
    return metaOf(session)
  }

  function rename(workspace: string, id: string, title: string): ChatSessionMeta | null {
    const session = get(workspace, id)
    if (!session) return null
    session.title = singleLine(title).slice(0, TITLE_MAX_CHARS * 2)
    session.updatedAt = Date.now()
    writeSession(workspace, session)
    return metaOf(session)
  }

  function setCliSession(workspace: string, id: string, cliSessionId: string): void {
    const session = get(workspace, id)
    if (!session) return
    session.cliSessionId = cliSessionId
    writeSession(workspace, session)
  }

  function search(workspace: string, query: string): ChatSessionMeta[] {
    const needle = searchNormalize(query.trim())
    if (needle === '') return list(workspace)
    const dir = workspaceDir(workspace)
    if (!existsSync(dir)) return []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return []
    }
    const hits: ChatSessionMeta[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const session = readSession(join(dir, entry))
      if (!session) continue
      if (searchNormalize(session.title).includes(needle)) {
        hits.push({ ...metaOf(session), match: null })
        continue
      }
      const matched = session.messages
        .map((message) => matchSnippet(message.text, needle))
        .find((snippet) => snippet !== null)
      if (matched !== undefined) {
        hits.push({ ...metaOf(session), match: matched })
      }
    }
    return hits.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function remove(workspace: string, id: string): void {
    const filePath = sessionPath(workspace, id)
    if (!filePath) return
    try {
      unlinkSync(filePath)
    } catch {
      // Already gone (or unreadable) — the end state holds either way.
    }
  }

  return { list, get, create, appendMessage, rename, setCliSession, search, remove }
}
