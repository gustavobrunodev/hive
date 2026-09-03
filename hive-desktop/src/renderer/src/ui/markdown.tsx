import { createElement } from 'react'
import type { MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * `.md` file preview (task T1, design.md §5 "Markdown renderer" — UX-R7).
 *
 * Wraps `react-markdown` + `remark-gfm` so BMAD-produced artifacts (PRDs,
 * specs, task lists) — which commonly use tables, nested lists, links, and
 * task lists — render faithfully. This replaces an earlier hand-rolled
 * line-based transform (see git history) that only covered a small subset
 * of CommonMark and had no support for tables/links/nested lists.
 *
 * Deliberately **no** `rehype-raw`: embedded raw HTML in markdown source is
 * never rendered, so workspace artifacts can't inject arbitrary DOM into the
 * app shell (context.md C2).
 */
export interface MarkdownProps {
  /** Raw markdown source to render (data, not UI copy — exempt from the i18n/noInlineStrings guard). */
  source: string
}

/**
 * Links (UX-R7.3): never let a markdown link navigate the renderer SPA.
 * Instead hand the href to the main process via the `window.hive.openExternal`
 * bridge (T3), which itself only forwards `http(s):`/`mailto:` URLs to
 * `shell.openExternal` — anything else (including `javascript:`) is rejected
 * before it ever reaches the OS.
 */
function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string): void {
  event.preventDefault()
  if (href) void window.hive.openExternal(href)
}

/**
 * A block element that remembers where it came from.
 *
 * `data-line` is the source line that produced this block, and it is the only
 * thing the edit ⇄ preview toggle can steer by: the two surfaces lay the same
 * document out at completely different heights, so a scroll *position* means
 * nothing across the crossing while a *line* means the same on both sides.
 * See `explorer/scrollSync.ts`, which reads these back.
 *
 * The attribute is inert otherwise — it changes no rendering and no semantics.
 */
function anchored<Tag extends keyof React.JSX.IntrinsicElements>(tag: Tag) {
  return function Anchored({
    node,
    ...props
  }: React.JSX.IntrinsicElements[Tag] & {
    node?: { position?: { start?: { line?: number } } }
  }): React.JSX.Element {
    return createElement(tag, { ...props, 'data-line': node?.position?.start?.line })
  }
}

/**
 * Every block-level element the renderer can emit. Inline elements are
 * deliberately left out: an anchor inside a paragraph is not a scroll target,
 * and stamping every `<em>` would put thousands of attributes in a long
 * document to no purpose.
 */
const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} onClick={(event) => handleLinkClick(event, href)}>
      {children}
    </a>
  ),
  h1: anchored('h1'),
  h2: anchored('h2'),
  h3: anchored('h3'),
  h4: anchored('h4'),
  h5: anchored('h5'),
  h6: anchored('h6'),
  p: anchored('p'),
  li: anchored('li'),
  pre: anchored('pre'),
  blockquote: anchored('blockquote'),
  table: anchored('table'),
  hr: anchored('hr')
}

export function Markdown({ source }: MarkdownProps): React.JSX.Element {
  return (
    <div className="hds-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
