import type { ScreenDocument, ScreenNode } from '../types'

/**
 * Design Studio (M18) — T7.1. The Bundle's markup, and the only place it is
 * built (AD-6, DS-R14 AC-2).
 *
 * The Export exists to hand a Screen to something outside the app, so the one
 * thing it must never become is a *second* renderer. A separate markup path
 * would drift from the Preview the moment either side gained a rule — a prop
 * spelled differently, a boolean written as `"false"`, a slot forgotten — and
 * the drift would only show up in the artifact the user already sent on. So the
 * shapes below mirror `src/preview/dom.ts` deliberately and are pinned to it by
 * test: same stage id, same node attribute, same "a boolean attribute is true
 * by its presence" rule.
 *
 * It lives inside `dsAdapter/` because the knowledge it encodes — which files
 * make a Web Awesome document self-contained, and that the components are
 * custom elements that upgrade on their own — is design-system knowledge. The
 * exporter above it only chooses a filename and writes bytes (T7.2).
 */

/** The two assets a Web Awesome document needs inlined to render with no network. */
export interface StaticAssets {
  /** `webawesome.css` — theme + native styles, flattened at build time. */
  style: string
  /** `webawesome.js` — the single ESM bundle, icon library included (T2.6). */
  script: string
}

/**
 * Mirrors `src/preview/receiver.ts` and `src/preview/dom.ts`. Restated rather
 * than imported: the frame is its own process zone with its own bundle, so the
 * two cannot share a module — `staticHtml.test.ts` asserts they agree.
 */
export const EXPORT_STAGE_ID = 'hive-stage'
export const EXPORT_NODE_ID_ATTRIBUTE = 'data-hive-node'

/** A custom element name, which is all a `ScreenNode.tag` is ever allowed to be. */
const TAG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

/**
 * Escapes an attribute value. Every prop value in a `ScreenDocument` reaches
 * the file through here, which is what keeps a string typed into the Inspector
 * a *value* in the exported document rather than markup in it.
 */
export function escapeAttribute(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ESCAPES[character])
}

/**
 * Neutralises the one sequence that can end an inlined `<script>`/`<style>`
 * from inside its own text. Belt only — `staticHtml.test.ts` asserts the real
 * bundle contains neither, so this never fires on the assets we ship; it exists
 * so a future bundle cannot break the artifact silently.
 */
export function inlineSafe(text: string, element: 'script' | 'style'): string {
  return text.replace(new RegExp(`</(${element})`, 'gi'), '<\\/$1')
}

/**
 * One attribute pair, or `null` when the prop is not written at all.
 *
 * `false` and `''` remove the attribute and `true` writes it bare, exactly as
 * `applyProp()` does in the frame: a boolean attribute is true by its presence,
 * so `disabled="false"` would turn the prop *on*.
 */
function attribute(key: string, value: string | number | boolean): string | null {
  if (value === false || value === '') return null
  if (value === true) return key
  return `${key}="${escapeAttribute(String(value))}"`
}

function renderNode(node: ScreenNode, knownTags: ReadonlySet<string>): string {
  if (!TAG_PATTERN.test(node.tag) || !knownTags.has(node.tag)) {
    throw new Error(
      `O Componente "${node.tag}" não existe no design system ativo — ` +
        `a Tela não pode ser exportada.`
    )
  }
  const attributes = [
    `${EXPORT_NODE_ID_ATTRIBUTE}="${escapeAttribute(node.id)}"`,
    ...(node.slot === undefined || node.slot === '' ? [] : [attribute('slot', node.slot)!]),
    ...Object.entries(node.props)
      .map(([key, value]) => attribute(key, value))
      .filter((pair): pair is string => pair !== null)
  ].join(' ')
  const children = node.children.map((child) => renderNode(child, knownTags)).join('')
  // Never self-closed: a custom element with no children still needs its end
  // tag, and `<wa-card/>` would swallow the rest of the document.
  return `<${node.tag} ${attributes}>${children}</${node.tag}>`
}

/** The Screen's tree as markup, or the empty string for a Screen with no Components. */
export function renderScreenMarkup(
  document: ScreenDocument,
  knownTags: ReadonlySet<string>
): string {
  return document.root === null ? '' : renderNode(document.root, knownTags)
}

/**
 * The whole self-contained document (DS-R14 AC-1).
 *
 * The assets are inlined rather than linked, and the element tree sits in the
 * body ahead of the module script — custom elements upgrade whenever their
 * definition arrives, so a deferred module is exactly right and no in-document
 * script is needed to bootstrap anything. That is what makes the artifact a
 * single file with zero requests: no stylesheet link, no bundle URL, no icon
 * fetch (the library the bundle registers answers from `data:` — D-DS-8).
 */
export function renderStaticDocument(
  document: ScreenDocument,
  assets: StaticAssets,
  knownTags: ReadonlySet<string>
): string {
  const markup = renderScreenMarkup(document, knownTags)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttribute(document.title)}</title>
<style>${inlineSafe(assets.style, 'style')}</style>
</head>
<body>
<div id="${EXPORT_STAGE_ID}">${markup}</div>
<script type="module">${inlineSafe(assets.script, 'script')}</script>
</body>
</html>
`
}
