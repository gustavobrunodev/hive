import { t } from '../i18n'

/**
 * `.html` live preview (task T4, design.md §6 "HTML preview" — UX-R8).
 *
 * Renders arbitrary workspace HTML inside a sandboxed `srcDoc` iframe.
 * `sandbox="allow-scripts"` deliberately omits `allow-same-origin`: the
 * frame gets an opaque origin, so injected scripts can execute (needed for
 * anything interactive BMAD/agents produce) but can never reach
 * `window.parent`, cookies, or the workspace filesystem — matches the app's
 * `sandbox: true` BrowserWindow posture (context.md C4). No
 * `allow-top-navigation` either, so the frame can't hijack the renderer SPA.
 *
 * `reloadKey` (T4/T5 wiring, UX-R8.2): bumped by the caller whenever the
 * on-disk file changes (via `watchWorkspace`, M4), keyed onto the iframe so
 * React fully remounts it — a plain `srcDoc` update alone would leave any
 * injected script's prior state (timers, DOM mutations, in-page globals)
 * running, which is wrong for a "reload on disk change" preview.
 *
 * Known limitation (UX-R8.3): `srcdoc` has no base URL, so relative asset
 * references (`./style.css`, `./img.png`) 404. A local-server-backed preview
 * is deferred to a future task.
 */
export interface HtmlPreviewProps {
  /** HTML source to render (draft or on-disk content — data, exempt from noInlineStrings). */
  source: string
  /** Remount key — bump on each on-disk reload to reset iframe internal state. */
  reloadKey: string | number
}

export function HtmlPreview({ source, reloadKey }: HtmlPreviewProps): React.JSX.Element {
  return (
    <iframe
      key={reloadKey}
      className="wb-html-preview"
      title={t('explorer.htmlPreviewLabel')}
      sandbox="allow-scripts"
      srcDoc={source}
    />
  )
}
