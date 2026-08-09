/**
 * Design Studio (M18) — the document model and the two failure shapes.
 *
 * This file is the root of the module: pure types, zero runtime, zero
 * Electron/DOM/agent. Everything else in `designStudio/` is built on it.
 *
 * Two invariants are encoded here rather than documented elsewhere:
 *
 *  - **AD-2 — one atomic change per `Command`.** The union is *closed* and
 *    `SetProp` carries `{ componentId, key, value }`, never a bag of props.
 *    A bag would make "undo one step" ambiguous (which of the six fields did
 *    the user mean?) and would let a single entry in the log hide an
 *    arbitrary amount of change. Grouping is the log's job (`groupId`), not
 *    the command's.
 *  - **DS-R17 — exactly two failure shapes, never a third.**
 *    `CapabilityViolation` (the active catalog does not have this
 *    component/prop/value) and `OperationError` (something outside the
 *    document failed: the agent, the preview, an export, disk I/O). Every
 *    surface renders these two and nothing ad hoc.
 */

/** Um nó da Tela. `id` é estável por Tela, atribuído na criação (AD-2). */
export interface ScreenNode {
  id: string
  /** Sempre uma tag do catálogo ativo. */
  tag: string
  props: Record<string, string | number | boolean>
  /** Slot do pai; ausente = slot default. */
  slot?: string
  children: ScreenNode[]
}

export interface ScreenDocument {
  screenId: string
  title: string
  /** `null` = Tela ainda vazia. */
  root: ScreenNode | null
}

/** Vocabulário FECHADO. Cada Command = exatamente uma mudança atômica (AD-2). */
export type Command =
  | {
      type: 'AddComponent'
      /** `null` = o nó vira a raiz da Tela. */
      parentId: string | null
      slot?: string
      index: number
      node: ScreenNode
    }
  | { type: 'RemoveComponent'; componentId: string }
  | {
      type: 'MoveComponent'
      componentId: string
      newParentId: string
      slot?: string
      index: number
    }
  | {
      type: 'SetProp'
      componentId: string
      key: string
      /** `null` = remover a prop (edge case do spec: enum que recebe vazio). */
      value: string | number | boolean | null
    }

/** Uma entrada do log: um Command, o passo agrupado a que pertence, e quando. */
export interface CommandLogEntry {
  command: Command
  groupId: string
  at: number
}

/** Log linear por Tela. `groupId` agrupa o turno de chat num passo (AD-8). */
export interface CommandLog {
  entries: CommandLogEntry[]
  /** Quantas entradas estão aplicadas. */
  cursor: number
}

/** Um turno do Chat de Iteração, persistido por Tela (DS-R10 AC-7). */
export interface StudioChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /** O passo agrupado que este turno produziu — o que `↩ desfazer este turno` desfaz. */
  groupId?: string
}

/** O catálogo derivado do CEM (P-2). Única fonte de verdade (DS-R13). */
export interface CatalogProp {
  name: string
  kind: 'enum' | 'boolean' | 'string' | 'number'
  /** Presente sse `kind === 'enum'`. */
  values?: string[]
  default?: string | number | boolean
  group: 'appearance' | 'state' | 'content' | 'advanced'
}

export interface CatalogComponent {
  tag: string
  summary?: string
  slots: string[]
  props: CatalogProp[]
}

export interface ComponentCatalog {
  dsId: string
  version: string
  components: CatalogComponent[]
}

/** Mismatch de catálogo: o DS ativo não tem esse Componente/prop/valor (DS-R17). */
export interface CapabilityViolation {
  kind: 'capability'
  componentId: string
  reason: string
  attemptedValue?: unknown
}

/** Falha fora do documento: agente, preview, export, I/O (DS-R17). */
export interface OperationError {
  kind: 'operation'
  scope: 'agent' | 'preview' | 'export' | 'io'
  message: string
  retryable: boolean
}

/** O estado de uma Tela dentro da sessão persistida. */
export interface StudioScreenState {
  screenId: string
  title: string
  log: CommandLog
  transcript: StudioChatMessage[]
}

/** Uma sessão em disco, chaveada por (specPathHash, workspaceHash) (AD-7). */
export interface StudioSession {
  specPath: string
  workspace: string
  /** Telas não migram ao trocar DS (DS-R12). */
  dsId: string
  activeScreenId: string | null
  screens: StudioScreenState[]
}
