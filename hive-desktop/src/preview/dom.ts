import type { PreviewNode } from './messages'

/**
 * Design Studio (M18) — T3.4. DOM construction inside the Preview (AD-4).
 *
 * **Nothing here parses a string into markup.** Elements come from
 * `createElement` and every value is written through `setAttribute` /
 * `removeAttribute`, which treat what they are given as data, not as source.
 * `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write` and template
 * interpolation are absent by construction, and the T3.4 guard asserts that
 * against the *built bundle* rather than against this file — a dependency could
 * reintroduce one, and reading the source would not notice.
 *
 * The catalog's prop names are the CEM's **attribute** names (`with-caret`,
 * `auto-width`), so attributes are also simply the right channel.
 */

/** The attribute that ties a rendered element back to its `ScreenNode.id`. */
export const NODE_ID_ATTRIBUTE = 'data-hive-node'

/**
 * Writes one prop. `false` and `''` remove the attribute — a boolean attribute
 * is true by its presence, so writing `"false"` would turn the prop on.
 */
export function applyProp(element: Element, key: string, value: string | number | boolean): void {
  if (value === false || value === '') {
    element.removeAttribute(key)
    return
  }
  element.setAttribute(key, value === true ? '' : String(value))
}

/** Syncs an element's attributes to a node's props and slot, in place. */
export function applyProps(element: Element, node: PreviewNode): void {
  for (const [key, value] of Object.entries(node.props)) applyProp(element, key, value)
  if (node.slot === undefined || node.slot === '') element.removeAttribute('slot')
  else element.setAttribute('slot', node.slot)
}

/** A fresh element for a node, with its id, props and slot already on it. */
export function createNodeElement(document: Document, node: PreviewNode): Element {
  const element = document.createElement(node.tag)
  element.setAttribute(NODE_ID_ATTRIBUTE, node.id)
  applyProps(element, node)
  return element
}

/** Builds a whole subtree. Used for a first render and for newly added nodes. */
export function buildSubtree(document: Document, node: PreviewNode): Element {
  const element = createNodeElement(document, node)
  for (const child of node.children) element.appendChild(buildSubtree(document, child))
  return element
}
