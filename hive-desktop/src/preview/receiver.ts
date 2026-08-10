import { buildSubtree } from './dom'
import { messageFor, type PreviewDocument, type PreviewInbound } from './messages'

/**
 * Design Studio (M18) — T3.4. The script that runs inside the Preview frame.
 *
 * It has no imports from `src/main` or `src/renderer`: the frame is a third
 * process zone with its own bundle, and everything it needs arrives either in
 * its URL (the session nonce) or by `postMessage` (the document).
 *
 * The handshake exists because the parent has no way to know when a sandboxed,
 * opaque-origin frame finished loading its modules — `load` fires on the
 * document, not on the custom elements, and a `render` that arrives first would
 * be dropped in silence. So the frame speaks first: `ready`, carrying the nonce
 * back, which is also how the parent learns the frame is the one it addressed.
 */

/** Where the rendered Screen lives. Selection chrome (T3.6) stays outside it. */
export const STAGE_ID = 'hive-stage'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

/**
 * The session token, read off the frame's own URL (`/<token>/index.html`).
 *
 * This is why the shell needs no inline script: under `script-src 'self'` an
 * inline block would need a hash or a nonce attribute, and every route to one
 * ends in interpolating the token into markup.
 */
export function tokenFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter((segment) => segment !== '')
  const token = segments[0]
  return token !== undefined && TOKEN_PATTERN.test(token) ? token : null
}

export interface PreviewReceiver {
  /** Announces `ready` to the parent and starts accepting messages. */
  start(): void
  dispose(): void
}

export function createPreviewReceiver(win: Window): PreviewReceiver {
  // `''` for a frame with no session in its URL — a value no message can
  // carry, so the check below and the message check are the same guard.
  const nonce = tokenFromPath(win.location.pathname) ?? ''
  const doc = win.document

  // Created by `start()`, which is also the only thing that begins listening —
  // so by the time a message can arrive, the stage exists.
  let stage = doc.createElement('div')
  stage.id = STAGE_ID

  function render(next: PreviewDocument): void {
    stage.replaceChildren()
    if (next.root) stage.appendChild(buildSubtree(doc, next.root))
  }

  function onMessage(event: MessageEvent): void {
    const message = messageFor<PreviewInbound>(event.data, nonce, ['render', 'select'])
    if (message?.type === 'render') render(message.document)
  }

  return {
    start() {
      // A frame that cannot name its own session never speaks: it would have
      // no nonce to authenticate with, so anything it sent would be noise the
      // parent is required to ignore anyway.
      if (nonce === '') return
      win.addEventListener('message', onMessage)
      doc.body.appendChild(stage)
      win.parent.postMessage({ type: 'ready', nonce }, '*')
    },
    dispose() {
      win.removeEventListener('message', onMessage)
      stage.remove()
      stage = doc.createElement('div')
      stage.id = STAGE_ID
    }
  }
}
