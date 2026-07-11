import type { MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
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

export function Markdown({ source }: MarkdownProps): React.JSX.Element {
  return (
    <div className="hds-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} onClick={(event) => handleLinkClick(event, href)}>
              {children}
            </a>
          )
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
