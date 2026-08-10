import type { ScreenNode } from './documentModel'

/**
 * Design Studio (M18) — T5.1. Pure readings of a Tela's node hierarchy.
 *
 * Separate from `ComponentTree.tsx` so the component file exports a component
 * and nothing else, and so the walks below can be tested without rendering.
 */

/** The node with `id`, anywhere in the subtree. `null` when nothing is selected. */
export function findNode(node: ScreenNode | null, id: string | null): ScreenNode | null {
  if (node === null || id === null) return null
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

/** Every id in the subtree, root first, in the order the tree shows them. */
export function allNodeIds(node: ScreenNode | null): string[] {
  if (node === null) return []
  return [node.id, ...node.children.flatMap((child) => allNodeIds(child))]
}
