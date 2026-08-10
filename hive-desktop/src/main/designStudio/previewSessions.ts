import { randomBytes } from 'crypto'
import { STUDIO_PREVIEW_HOST, STUDIO_SCHEME } from './previewProtocol'

/**
 * Design Studio (M18) — T3.3. The per-session Preview URL and its shell.
 *
 * **The token is random, and that is the whole point (AD-7, P1-Preview AC-6).**
 * `sessionStore.key()` mints a *deterministic* `(specPathHash, workspaceHash)`
 * pair, because reopening the same Spec in the same workspace must find the
 * same session on disk. A URL token derived from that pair would inherit the
 * same property in a place where it is the exact wrong one: anything that
 * learned the Spec's path could reconstruct the Preview URL, and the token
 * doubles as the message nonce (D-DS-4), so a guessable token is a forgeable
 * message. The two identifiers answer different questions — "which session is
 * this?" and "is this really my frame?" — and keeping them distinct is what
 * lets the second one be unguessable.
 *
 * The shell carries **no inline script**: `script-src 'self'` allows one, but
 * only via a hash or nonce, and every mechanism for that ends in interpolating
 * a value into markup. Instead the receiver reads its own token off
 * `location.pathname`, which the sandbox lets it do and nothing else can.
 */

/** 32 bytes of CSPRNG output, hex. Also the message nonce (D-DS-4). */
export type PreviewToken = string

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

/** Where the DS bundle and the receiver live under the `preview` root. */
export const DS_BUNDLE_PATH = '/design-system-web-awesome'
export const RECEIVER_PATH = '/design-studio-preview'

export interface PreviewSessions {
  /** Opens a Preview session and returns its unguessable token. */
  open(): PreviewToken
  /** The `hive-studio://` URL the iframe's `src` points at. */
  url(token: PreviewToken): string
  /** `true` while the token names a live session. */
  has(token: PreviewToken): boolean
  /** Ends the session; its URL stops resolving. */
  close(token: PreviewToken): void
  /**
   * The `StudioShellResolver` the protocol handler is composed with: the shell
   * document for a live session's URL, `null` for anything else — including a
   * well-formed token that was never opened or has been closed.
   */
  shellFor(url: string): string | null
}

/**
 * Splits `/<token>/index.html` off a Preview URL, or `null` when the URL is
 * not a session shell. Pure, so the routing rule is testable on its own.
 */
export function shellTokenOf(url: string): PreviewToken | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${STUDIO_SCHEME}:` || parsed.hostname !== STUDIO_PREVIEW_HOST) {
    return null
  }
  const segments = parsed.pathname.split('/').filter((segment) => segment !== '')
  if (segments.length !== 2 || segments[1] !== 'index.html') return null
  return TOKEN_PATTERN.test(segments[0]) ? segments[0] : null
}

/**
 * The document served for a live session.
 *
 * Asset URLs are root-absolute rather than relative: the shell lives at
 * `/<token>/index.html`, so `./webawesome.js` would resolve under the token
 * directory — a path that is not on disk and never will be.
 */
export function renderPreviewShell(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Studio — Preview</title>
<link rel="stylesheet" href="${DS_BUNDLE_PATH}/webawesome.css">
<script type="module" src="${DS_BUNDLE_PATH}/webawesome.js"></script>
<script type="module" src="${RECEIVER_PATH}/receiver.js"></script>
</head>
<body></body>
</html>
`
}

/**
 * The live-session table.
 *
 * `randomToken` is injected only so a test can prove the *registry* keeps
 * tokens distinct without depending on luck; production always gets the
 * CSPRNG.
 */
export function createPreviewSessions(
  randomToken: () => PreviewToken = () => randomBytes(32).toString('hex')
): PreviewSessions {
  const live = new Set<PreviewToken>()
  return {
    open() {
      const token = randomToken()
      live.add(token)
      return token
    },
    url(token) {
      return `${STUDIO_SCHEME}://${STUDIO_PREVIEW_HOST}/${token}/index.html`
    },
    has(token) {
      return live.has(token)
    },
    close(token) {
      live.delete(token)
    },
    shellFor(url) {
      const token = shellTokenOf(url)
      return token !== null && live.has(token) ? renderPreviewShell() : null
    }
  }
}
