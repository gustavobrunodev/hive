import { messageFor } from '../../../preview/messages'
import type { PreviewDocument, PreviewOutbound } from '../../../preview/messages'

/**
 * Design Studio (M18) — T3.7. The parent half of the Preview channel
 * (D-DS-4, R-5, design §1.1).
 *
 * **There is no origin to check.** The frame is `sandbox="allow-scripts"`
 * without `allow-same-origin`, so its origin is opaque and `event.origin`
 * arrives as the literal string `"null"` — the same value any other sandboxed
 * document on the page would produce. Comparing it would be a control that
 * looks like a control and stops nothing, which is worse than no control at
 * all, because it stops anyone looking further.
 *
 * What actually distinguishes our frame is two facts an attacker cannot both
 * have:
 *   1. `event.source === frame.contentWindow` — the message came from *this*
 *      frame's window object, not from another frame, another tab, or the page
 *      itself;
 *   2. `message.nonce === nonce` — it carries the unguessable per-session token
 *      that only ever existed in this frame's URL.
 *
 * Both are required. Either alone is defeatable: a same-page frame we did not
 * open can post freely (fails 2 only if we check it), and a leaked nonce
 * replayed from another window is still another window (fails 1 only if we
 * check it).
 *
 * Sending goes out with `'*'` as the target origin, which is not laxity: an
 * opaque origin cannot be named, so a specific target origin would mean the
 * message is never delivered. The `contentWindow` reference is what scopes it.
 */

/**
 * The session token lives in the URL's first path segment, and it is also the
 * postMessage nonce (AD-7, D-DS-4) — it never travels any other way, so this is
 * the one place the two facts meet.
 */
export function nonceFromUrl(url: string): string | null {
  return /^hive-studio:\/\/preview\/([0-9a-zA-Z]+)\//.exec(url)?.[1] ?? null
}

export interface PreviewBridgeOptions {
  frame: HTMLIFrameElement
  /** The session token from the frame's URL — also the message nonce. */
  nonce: string
  /** Fired once, when the frame's receiver has announced itself. */
  onReady?: () => void
  /** A Component was clicked on the stage (DS-R5). */
  onSelected?: (componentId: string | null) => void
  /** The window that owns the frame. Injected for tests. */
  window?: Window
}

export interface PreviewBridge {
  /** Pushes the whole document; the receiver reconciles by node id (D-DS-6). */
  render(document: PreviewDocument): void
  /** Mirrors a Tree selection onto the stage (DS-R5 AC-5). */
  select(componentId: string | null): void
  /** True once the frame has handshaken. */
  isReady(): boolean
  dispose(): void
}

export function createPreviewBridge(options: PreviewBridgeOptions): PreviewBridge {
  const { frame, nonce, onReady, onSelected } = options
  const host = options.window ?? window

  let ready = false
  // The receiver's modules load asynchronously, so the first document usually
  // exists before the frame can accept it. Holding the latest one — not a
  // queue — is right: they are snapshots, and only the last is true.
  let pending: PreviewDocument | null = null

  function post(message: Record<string, unknown>): void {
    frame.contentWindow?.postMessage({ ...message, nonce }, '*')
  }

  function onMessage(event: MessageEvent): void {
    // Control 1: the message came from this frame's window.
    if (event.source !== frame.contentWindow) return
    // Control 2: it carries this session's nonce.
    const message = messageFor<PreviewOutbound>(event.data, nonce, ['ready', 'selected'])
    if (!message) return

    if (message.type === 'ready') {
      ready = true
      if (pending) {
        post({ type: 'render', document: pending })
        pending = null
      }
      onReady?.()
      return
    }
    onSelected?.(message.componentId)
  }

  host.addEventListener('message', onMessage)

  return {
    render(document) {
      if (!ready) {
        pending = document
        return
      }
      post({ type: 'render', document })
    },
    select(componentId) {
      if (ready) post({ type: 'select', componentId })
    },
    isReady: () => ready,
    dispose() {
      host.removeEventListener('message', onMessage)
      pending = null
    }
  }
}
