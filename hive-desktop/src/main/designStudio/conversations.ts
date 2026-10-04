import { readdirSync } from 'fs'
import { join } from 'path'
import type { ChatHistoryStore, ChatSessionMeta } from '../chatHistoryStore'

/** A module conversation, as "Recentes" lists it: the history row plus the Produto it belongs to. */
export interface ModuleConversationMeta extends ChatSessionMeta {
  /** The Produto folder the conversation is keyed under — also its display name (decision 3). */
  produto: string
}

/**
 * The Produto folders under `<raiz>`. A folder is a Produto (decision 3), so
 * this is the list — no catalog to keep in step with it. A root that does not
 * exist yet, or cannot be read, has none.
 */
function produtoFolders(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

/**
 * Every module conversation, across the Produtos (Landing 8 and 10).
 *
 * A module conversation is an ordinary history session whose workspace key is
 * `<raiz>/<Produto>`, so the store answers for each folder exactly as it does
 * for a Hive workspace — same hashing, same files, nothing to migrate. Order is
 * the renderer's job: "Recentes" sorts and caps what this returns.
 */
export function listModuleConversations(
  store: ChatHistoryStore,
  root: string
): ModuleConversationMeta[] {
  return produtoFolders(root).flatMap((produto) =>
    store.list(join(root, produto)).map((meta) => ({ ...meta, produto }))
  )
}
