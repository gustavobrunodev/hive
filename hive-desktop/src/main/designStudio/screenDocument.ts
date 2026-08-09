import type { Command, ScreenDocument, ScreenNode } from './types'

/**
 * Design Studio (M18) — the single mutation of a `ScreenDocument` (AD-2).
 *
 * Every surface (Inspector, Tree, Chat) changes a screen by dispatching a
 * `Command` through here. Nothing else writes to `.props`/`.children`; a
 * boundary test enforces that, so the rule survives the next contributor.
 *
 * **This reducer does not validate** (DS-R9 AC-3). Validation belongs to
 * `DesignSystemAdapter.validate()` and runs *before* dispatch, so that a
 * catalog mismatch is a `CapabilityViolation` the user can read — not an
 * exception thrown from inside an undo replay. The consequence is that
 * `applyCommand` must be **total**: any command, however nonsensical, yields
 * a document rather than a throw. A command that cannot land (unknown parent,
 * unknown component, a move into the node's own subtree) is a no-op returning
 * the document unchanged, because "unchanged" is the only answer that keeps
 * replay deterministic.
 *
 * It is also pure: the input document is never mutated, only the path from
 * the root down to the touched node is rebuilt. Replay-from-origin (AD-8)
 * depends on both properties.
 */

/** Keeps an out-of-range index predictable — `splice` would otherwise read a negative index from the end. */
function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.trunc(index), length))
}

/** Stamps the command's slot onto a node; an absent slot leaves the node's own slot alone. */
function withSlot(node: ScreenNode, slot: string | undefined): ScreenNode {
  return slot === undefined ? node : { ...node, slot }
}

/**
 * Rebuilds `node` with `child` inserted into `parentId`'s children at `index`.
 * Returns `null` when `parentId` is nowhere in this subtree — the signal the
 * callers turn into a no-op.
 */
function insertInto(
  node: ScreenNode,
  parentId: string,
  index: number,
  child: ScreenNode
): ScreenNode | null {
  if (node.id === parentId) {
    const children = [...node.children]
    children.splice(clampIndex(index, children.length), 0, child)
    return { ...node, children }
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const rebuilt = insertInto(node.children[i], parentId, index, child)
    if (rebuilt) {
      const children = [...node.children]
      children[i] = rebuilt
      return { ...node, children }
    }
  }
  return null
}

/** Rebuilds `node` without the descendant `id`, also handing back the detached subtree (for moves). */
function detach(node: ScreenNode, id: string): { node: ScreenNode; removed: ScreenNode | null } {
  const at = node.children.findIndex((child) => child.id === id)
  if (at !== -1) {
    const children = [...node.children]
    const [removed] = children.splice(at, 1)
    return { node: { ...node, children }, removed }
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const result = detach(node.children[i], id)
    if (result.removed) {
      const children = [...node.children]
      children[i] = result.node
      return { node: { ...node, children }, removed: result.removed }
    }
  }
  return { node, removed: null }
}

/** Rebuilds `node` with one prop of `id` written (or deleted, when `value` is `null`). Returns `null` when `id` is absent. */
function writeProp(
  node: ScreenNode,
  id: string,
  key: string,
  value: string | number | boolean | null
): ScreenNode | null {
  if (node.id === id) {
    const props = { ...node.props }
    if (value === null) {
      delete props[key]
    } else {
      props[key] = value
    }
    return { ...node, props }
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const rebuilt = writeProp(node.children[i], id, key, value)
    if (rebuilt) {
      const children = [...node.children]
      children[i] = rebuilt
      return { ...node, children }
    }
  }
  return null
}

/** `{ ...doc, root }` when the rebuild landed, the untouched document when it didn't. */
function withRoot(doc: ScreenDocument, root: ScreenNode | null): ScreenDocument {
  return root ? { ...doc, root } : doc
}

function add(
  doc: ScreenDocument,
  command: Extract<Command, { type: 'AddComponent' }>
): ScreenDocument {
  const node = withSlot(command.node, command.slot)
  // A null parent means "this is the screen's root" — the only way an empty
  // screen (`root: null`) ever gets its first component.
  if (command.parentId === null) return { ...doc, root: node }
  if (!doc.root) return doc
  return withRoot(doc, insertInto(doc.root, command.parentId, command.index, node))
}

function remove(
  doc: ScreenDocument,
  command: Extract<Command, { type: 'RemoveComponent' }>
): ScreenDocument {
  if (!doc.root) return doc
  if (doc.root.id === command.componentId) return { ...doc, root: null }
  const { node, removed } = detach(doc.root, command.componentId)
  return removed ? { ...doc, root: node } : doc
}

function move(
  doc: ScreenDocument,
  command: Extract<Command, { type: 'MoveComponent' }>
): ScreenDocument {
  if (!doc.root) return doc
  // The root has no parent to move under, and any target would be its own
  // descendant — a cycle. Rejecting cycles is `validate()`'s job; here it is
  // simply a no-op so the tree is never lost.
  if (doc.root.id === command.componentId) return doc
  const { node: pruned, removed } = detach(doc.root, command.componentId)
  if (!removed) return doc
  return withRoot(
    doc,
    insertInto(pruned, command.newParentId, command.index, withSlot(removed, command.slot))
  )
}

function setProp(
  doc: ScreenDocument,
  command: Extract<Command, { type: 'SetProp' }>
): ScreenDocument {
  if (!doc.root) return doc
  return withRoot(doc, writeProp(doc.root, command.componentId, command.key, command.value))
}

/**
 * Applies one `Command` to one screen, returning a new document. Pure, total,
 * and deliberately unvalidating (DS-R9 AC-1/AC-3).
 */
export function applyCommand(doc: ScreenDocument, command: Command): ScreenDocument {
  switch (command.type) {
    case 'AddComponent':
      return add(doc, command)
    case 'RemoveComponent':
      return remove(doc, command)
    case 'MoveComponent':
      return move(doc, command)
    case 'SetProp':
      return setProp(doc, command)
  }
}
