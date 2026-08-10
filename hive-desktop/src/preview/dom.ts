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

/**
 * Which attributes *we* wrote on an element, per element.
 *
 * Needed because a reconcile has to drop a prop the user removed, and "every
 * attribute that is not in `props`" is the wrong set: these are Lit components,
 * and they reflect their own state back to attributes. Stripping those would
 * start a fight with the component on every patch. A `WeakMap` keyed by the
 * element means the record dies with the node.
 */
const managedProps = new WeakMap<Element, Set<string>>()

/**
 * Syncs an element's attributes to a node's props and slot, **in place** —
 * this is what makes a `SetProp` a patch rather than a re-render (DS-R8).
 */
export function applyProps(element: Element, node: PreviewNode): void {
  const previous = managedProps.get(element)
  if (previous) {
    for (const name of previous) if (!(name in node.props)) element.removeAttribute(name)
  }
  const written = new Set<string>()
  for (const [key, value] of Object.entries(node.props)) {
    applyProp(element, key, value)
    written.add(key)
  }
  managedProps.set(element, written)

  if (node.slot === undefined || node.slot === '') element.removeAttribute('slot')
  else element.setAttribute('slot', node.slot)
}

/**
 * Puts `desired` in place as `parent`'s children, moving the nodes that are
 * already there instead of replacing them.
 *
 * `insertBefore` on an attached node *moves* it, so a reorder keeps every
 * element — and with it every bit of state the DOM holds and the document does
 * not: focus, scroll position, a text field's caret, a component's internal
 * state. Rebuilding would look identical in a screenshot and wrong under the
 * hands.
 */
export function syncChildren(parent: Element, desired: Element[]): void {
  desired.forEach((child, index) => {
    const current = parent.children[index]
    if (current !== child) parent.insertBefore(child, current ?? null)
  })
  while (parent.children.length > desired.length) parent.lastElementChild?.remove()
}

/** Every node this render already mounted, by `ScreenNode.id`. */
export function indexByNodeId(root: Element): Map<string, Element> {
  const index = new Map<string, Element>()
  for (const element of root.querySelectorAll(`[${NODE_ID_ATTRIBUTE}]`)) {
    index.set(element.getAttribute(NODE_ID_ATTRIBUTE)!, element)
  }
  return index
}

/**
 * Reconciles one node against what is already mounted, keyed by id (D-DS-6).
 *
 * An id whose element is already there and whose tag still matches is
 * **patched**; anything else is built fresh. The tag check matters: a node id
 * is stable across a `SetProp`, but `AddComponent`/`RemoveComponent` can put a
 * different Component under a previously-used id, and morphing a `wa-input`
 * into a `wa-button` is not something `setAttribute` can do.
 */
export function reconcileNode(
  document: Document,
  node: PreviewNode,
  mounted: Map<string, Element>
): Element {
  const existing = mounted.get(node.id)
  const element =
    existing && existing.tagName.toLowerCase() === node.tag.toLowerCase()
      ? existing
      : document.createElement(node.tag)
  element.setAttribute(NODE_ID_ATTRIBUTE, node.id)
  applyProps(element, node)
  syncChildren(
    element,
    node.children.map((child) => reconcileNode(document, child, mounted))
  )
  return element
}
