/**
 * Design Studio (M18) — T5.1. The document's shapes, mirrored for the renderer.
 *
 * Structural mirrors of `main/designStudio/types.ts` and the service's
 * `ScreenView`, not imports: the renderer never reaches across the process
 * boundary for a type (the convention `screens.ts`, `scm/gitStatus.ts` and
 * `secondBrain/useSecondBrain.ts` all follow, and which
 * `moduleBoundaries.test.ts` enforces).
 */

/** One node of the Tela. `id` is stable per Screen, assigned at creation (AD-2). */
export interface ScreenNode {
  id: string
  tag: string
  props: Record<string, string | number | boolean>
  /** Slot of the parent; absent = the default slot. */
  slot?: string
  children: ScreenNode[]
}

export interface ScreenDocument {
  screenId: string
  title: string
  /** `null` = the Tela has no Components yet. */
  root: ScreenNode | null
}

/** The CLOSED vocabulary. One atomic change per Command (AD-2). */
export type Command =
  | {
      type: 'AddComponent'
      /** `null` = the node becomes the Tela's root. */
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
      /** `null` = remove the prop (the spec's edge case for a cleared enum). */
      value: string | number | boolean | null
    }

/** A catalog mismatch: the active DS has no such Component/prop/value (DS-R17). */
export interface CapabilityViolation {
  kind: 'capability'
  componentId: string
  reason: string
  attemptedValue?: unknown
}

/** The catalog derived from the CEM — the single source of truth (DS-R13). */
export interface CatalogProp {
  name: string
  kind: 'enum' | 'boolean' | 'string' | 'number'
  /** Present iff `kind === 'enum'`. */
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

/** What every document operation resolves to: the Tela plus its two history affordances. */
export interface ScreenView {
  document: ScreenDocument
  canUndo: boolean
  canRedo: boolean
}

/**
 * A fresh id for one undoable step (AD-8). A manual edit is its own group; a
 * chat turn shares one across all the Commands it emitted.
 */
export function nextGroupId(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * T6.6 / §3.9: the nodes a batch of Commands touched, for the Preview's "what
 * just changed?" outline.
 *
 * A removal is deliberately not in the list: the node it names is gone by the
 * time the outline would be drawn, so pointing at it would mean pointing at
 * nothing. Duplicates are collapsed — a turn that adds a node and then sets a
 * prop on it changed one node, and outlining it twice would just draw a
 * heavier border.
 */
export function changedComponentIds(commands: readonly Command[]): string[] {
  const ids: string[] = []
  for (const command of commands) {
    const id = command.type === 'AddComponent' ? command.node.id : command.componentId
    if (command.type !== 'RemoveComponent' && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export function isCapabilityViolation(
  value: ScreenView | CapabilityViolation
): value is CapabilityViolation {
  return 'kind' in value && value.kind === 'capability'
}
