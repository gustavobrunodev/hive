import { t } from '../i18n'

/**
 * Shared session-history vocabulary (session-history) — its own module (not
 * a `SessionHistory.tsx` export) so that component file only exports a
 * component (react-refresh/only-export-components) while `Chat`/`IntentGrid`
 * can still consume the type + title fallback.
 */

/** Structural mirror of `main/chatHistoryStore.ts`'s `ChatSessionMeta`. */
export interface ChatSessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  agent: string | null
  preview: string
  /** Full-text `search()` results only: snippet around the first message-text match (null = the title matched). */
  match?: string | null
}

/** A session's display title — the auto/renamed title, or the untitled fallback. */
export function sessionTitle(meta: Pick<ChatSessionMeta, 'title'>): string {
  return meta.title !== '' ? meta.title : t('chatHistory.untitled')
}
