import type { Command, ComponentCatalog, ScreenDocument, ScreenNode } from './documentModel'
import { findNode } from './screenTree'

/**
 * Design Studio (M18) — T5.5. The Árvore's edits, as pure functions.
 *
 * Kept out of the component for the project's stated reason: drag-and-drop and
 * portalled menus are exactly what jsdom renders unreliably, so the decisions
 * that matter — *where* a Component lands, *which* tags may be offered, *which*
 * slots the parent declares — are values that can be asserted directly, and the
 * wiring around them stays thin enough to be obvious.
 *
 * Nothing here validates. Validation is `DesignSystemAdapter.validate()`'s job
 * and only its job (AD-2): a slot this file happily builds a Command for may
 * still come back as a `CapabilityViolation`, and that refusal is the answer
 * the user sees. Duplicating the rule here would create a second gate that
 * could disagree with the real one.
 */

/** Where a new Component would land, given what is selected right now. */
export interface AddTarget {
  /** `null` = the Tela is empty and the new Component becomes its root. */
  parentId: string | null
  /** The parent's tag, which is what decides the slots on offer. `null` at the root. */
  parentTag: string | null
  index: number
}

/**
 * The selected Component is the parent, because "add inside what I am looking
 * at" is the only reading of a click that does not need explaining. With
 * nothing selected the root takes the child; with no root at all, the new
 * Component *is* the root.
 */
export function addTargetFor(
  document: ScreenDocument,
  selectedComponentId: string | null
): AddTarget {
  const root = document.root
  if (root === null) return { parentId: null, parentTag: null, index: 0 }
  const parent = findNode(root, selectedComponentId) ?? root
  return { parentId: parent.id, parentTag: parent.tag, index: parent.children.length }
}

/** DS-R7 AC-1: the tags the active catalog declares, and no others. */
export function componentTags(catalog: ComponentCatalog | null): string[] {
  if (catalog === null) return []
  return catalog.components.map((component) => component.tag)
}

/**
 * DS-R7 AC-4: the slots the parent declares. The default slot travels as `''`,
 * the same name the CEM gives it, so the picker never invents one.
 */
export function slotOptionsFor(
  catalog: ComponentCatalog | null,
  parentTag: string | null
): string[] {
  if (catalog === null || parentTag === null) return []
  return catalog.components.find((component) => component.tag === parentTag)?.slots ?? []
}

/** A fresh node id. Stable per Tela once assigned; never reused (AD-2). */
export function nextNodeId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** The `AddComponent` for one picked tag in one picked slot. An empty slot is the default one, so it is omitted. */
export function addCommand(target: AddTarget, tag: string, slot: string): Command {
  const node: ScreenNode = { id: nextNodeId(), tag, props: {}, children: [] }
  return {
    type: 'AddComponent',
    parentId: target.parentId,
    index: target.index,
    ...(slot === '' ? {} : { slot }),
    node
  }
}

/** The `RemoveComponent` for one node. Reversible like any other step (DS-R7 AC-2). */
export function removeCommand(componentId: string): Command {
  return { type: 'RemoveComponent', componentId }
}

/** A node's parent and its position among that parent's children. `null` for the root. */
export function placeOf(
  root: ScreenNode | null,
  componentId: string | null
): { parent: ScreenNode; index: number } | null {
  if (root === null || componentId === null) return null
  const index = root.children.findIndex((child) => child.id === componentId)
  if (index !== -1) return { parent: root, index }
  for (const child of root.children) {
    const found = placeOf(child, componentId)
    if (found) return found
  }
  return null
}

/**
 * The slot a moved node should land in: the one it already sits in when the new
 * parent declares it, otherwise the new parent's first declared slot. Always an
 * explicit string — a move that left the slot alone would carry the old
 * parent's slot name into a parent that never declared it.
 */
export function slotForMove(
  catalog: ComponentCatalog | null,
  parentTag: string,
  currentSlot: string | undefined
): string {
  const slots = slotOptionsFor(catalog, parentTag)
  const current = currentSlot ?? ''
  if (slots.includes(current)) return current
  return slots[0] ?? current
}

function moveInto(
  catalog: ComponentCatalog | null,
  node: ScreenNode,
  newParent: ScreenNode,
  index: number
): Command {
  return {
    type: 'MoveComponent',
    componentId: node.id,
    newParentId: newParent.id,
    slot: slotForMove(catalog, newParent.tag, node.slot),
    index
  }
}

/**
 * Move **inwards**: the node becomes the last child of the sibling above it.
 *
 * Indent/outdent rather than drag-and-drop, for two reasons that both matter
 * here: the whole Studio has to be operable from the keyboard (DS-R18), and
 * jsdom's drag events are the project's known unreliable ground. Two moves that
 * are ordinary buttons reach any position in a Tela-sized tree, and every one
 * of them is a `MoveComponent` like any other.
 */
export function moveInsideCommand(
  document: ScreenDocument,
  catalog: ComponentCatalog | null,
  componentId: string | null
): Command | null {
  const place = placeOf(document.root, componentId)
  if (place === null || place.index === 0) return null
  const node = place.parent.children[place.index]
  const newParent = place.parent.children[place.index - 1]
  return moveInto(catalog, node, newParent, newParent.children.length)
}

/** Move **outwards**: the node becomes a sibling of its own parent, right after it. */
export function moveOutsideCommand(
  document: ScreenDocument,
  catalog: ComponentCatalog | null,
  componentId: string | null
): Command | null {
  const place = placeOf(document.root, componentId)
  if (place === null) return null
  const grandparent = placeOf(document.root, place.parent.id)
  if (grandparent === null) return null
  const node = place.parent.children[place.index]
  return moveInto(catalog, node, grandparent.parent, grandparent.index + 1)
}
