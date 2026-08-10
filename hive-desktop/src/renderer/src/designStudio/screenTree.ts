import type { ScreenNode } from './documentModel'

/**
 * Design Studio (M18) — T5.1. Pure readings of a Tela's node hierarchy.
 *
 * Separate from `ComponentTree.tsx` so the component file exports a component
 * and nothing else, and so the walks below can be tested without rendering.
 */

/** Every id in the subtree, root first, in the order the tree shows them. */
export function allNodeIds(node: ScreenNode | null): string[] {
  if (node === null) return []
  return [node.id, ...node.children.flatMap((child) => allNodeIds(child))]
}
