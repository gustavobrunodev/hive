import { indexByNodeId, NODE_ID_ATTRIBUTE, reconcileNode, syncChildren } from './dom'
import { createSelectionOverlay, nodeIdFromPath } from './overlay'
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

  const overlay = createSelectionOverlay(doc)
  let selectedId: string | null = null

  /** The element carrying a node id, or `null` when the node is not on stage. */
  function elementOf(id: string | null): Element | null {
    return id === null ? null : stage.querySelector(`[${NODE_ID_ATTRIBUTE}="${id}"]`)
  }

  function applySelection(id: string | null): void {
    selectedId = id
    overlay.select(elementOf(id))
  }

  /**
   * Reconciles the stage against the new document (D-DS-6, DS-R8).
   *
   * The parent sends the whole `ScreenDocument`, not the `Command` — a Command
   * would need the reducer duplicated in here, and two implementations of the
   * one mutation is exactly what AD-2 exists to prevent. What buys back the
   * "instant" is doing the diff here, by node id, so a `SetProp` patches an
   * attribute and touches nothing else.
   */
  function render(next: PreviewDocument): void {
    if (!next.root) {
      stage.replaceChildren()
      return
    }
    syncChildren(stage, [reconcileNode(doc, next.root, indexByNodeId(stage))])
    // The selected node may have been removed by this very render (the spec's
    // "o Componente selecionado é removido pelo chat"), so the outline is
    // re-measured against what is actually on stage now.
    overlay.select(elementOf(selectedId))
  }

  function onMessage(event: MessageEvent): void {
    const message = messageFor<PreviewInbound>(event.data, nonce, ['render', 'select'])
    if (message?.type === 'render') render(message.document)
    // The other direction of DS-R5 AC-5: the Tree selected something, and the
    // stage has to show it. Nothing is posted back — that would echo.
    if (message?.type === 'select') applySelection(message.componentId)
  }

  /**
   * A click anywhere on the stage selects the deepest Component under it, with
   * no mode to enter first (DS-R5 AC-4). Capture phase, so a Component that
   * stops propagation on its own click (buttons do) cannot swallow it.
   */
  function onClick(event: MouseEvent): void {
    const id = nodeIdFromPath(event.composedPath())
    applySelection(id)
    win.parent.postMessage({ type: 'selected', nonce, componentId: id }, '*')
  }

  function onPointerMove(event: PointerEvent): void {
    overlay.hover(elementOf(nodeIdFromPath(event.composedPath())))
  }

  function onViewportChange(): void {
    overlay.refresh()
  }

  return {
    start() {
      // A frame that cannot name its own session never speaks: it would have
      // no nonce to authenticate with, so anything it sent would be noise the
      // parent is required to ignore anyway.
      if (nonce === '') return
      win.addEventListener('message', onMessage)
      doc.addEventListener('click', onClick, true)
      doc.addEventListener('pointermove', onPointerMove, true)
      win.addEventListener('resize', onViewportChange)
      win.addEventListener('scroll', onViewportChange, true)
      doc.body.appendChild(stage)
      overlay.mount()
      win.parent.postMessage({ type: 'ready', nonce }, '*')
    },
    dispose() {
      win.removeEventListener('message', onMessage)
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('pointermove', onPointerMove, true)
      win.removeEventListener('resize', onViewportChange)
      win.removeEventListener('scroll', onViewportChange, true)
      overlay.dispose()
      selectedId = null
      stage.remove()
      stage = doc.createElement('div')
      stage.id = STAGE_ID
    }
  }
}
