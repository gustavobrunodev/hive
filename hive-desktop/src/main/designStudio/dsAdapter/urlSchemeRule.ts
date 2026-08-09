/**
 * Design Studio (M18) — T2.5. Scheme allowlist for URL-shaped props.
 *
 * P1-Preview AC-5: a URL-shaped prop (`href`, `src`, …) whose scheme is outside
 * `https:` / `http:` / `data:image/*` is a `CapabilityViolation`, rejected
 * **before** anything is assigned.
 *
 * This is a security control, not a nicety. The Preview renders whatever the
 * document says, and the document is written by an LLM turn over a Spec the
 * user did not audit line by line; `href: 'javascript:alert(1)'` is one
 * plausible model output away. The frame's `sandbox` and CSP are the second and
 * third layers — this is the first, and the only one that also covers the
 * exported Bundle, which runs in the user's own browser with no CSP of ours.
 *
 * The check is deliberately paranoid about the shapes a browser normalises away
 * before it parses a URL: leading control characters and spaces are stripped,
 * and TAB/LF/CR are removed from anywhere in the string. `java\tscript:alert(1)`
 * and ` JavaScript:alert(1)` both navigate; both are rejected here.
 */

import type { CatalogProp } from '../types'

export const ALLOWED_URL_SCHEMES = ['https:', 'http:'] as const

/**
 * Props whose value the browser resolves as a URL. Kept as a name list rather
 * than a heuristic: a `src`-like prop the list misses would silently lose the
 * control, so a new one has to be added deliberately.
 */
export const URL_SHAPED_PROPS = new Set(['href', 'src', 'srcdoc', 'formaction'])

export function isUrlShapedProp(name: string): boolean {
  return URL_SHAPED_PROPS.has(name)
}

/** What the browser sees after its own pre-parse normalisation. */
export function normalizeUrl(raw: string): string {
  const stripped = [...raw].filter((ch) => ch !== '\t' && ch !== '\n' && ch !== '\r').join('')
  let start = 0
  while (start < stripped.length && stripped.charCodeAt(start) <= 0x20) start += 1
  return stripped.slice(start)
}

/** RFC 3986: `scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i

const ALLOWED_SUFFIX = '(permitidos: https:, http:, data:image/*)'

/**
 * `null` when the value is safe to assign, otherwise the reason the caller
 * turns into a `CapabilityViolation`.
 */
export function urlSchemeReason(
  _tag: string,
  prop: CatalogProp,
  value: string | number | boolean | null
): string | null {
  if (!isUrlShapedProp(prop.name)) return null
  // Clearing the prop, and non-strings, are the catalog kind check's business.
  if (typeof value !== 'string' || value === '') return null

  const url = normalizeUrl(value)
  const match = SCHEME.exec(url)
  // No scheme at all — a relative URL, resolved against the Preview's own
  // origin, which the protocol handler already confines.
  if (!match) return null

  const scheme = `${match[1].toLowerCase()}:`
  if ((ALLOWED_URL_SCHEMES as readonly string[]).includes(scheme)) return null
  if (scheme === 'data:') {
    return /^data:image\//i.test(url)
      ? null
      : `Só "data:" de imagem é permitido em "${prop.name}" ${ALLOWED_SUFFIX}.`
  }
  return `O esquema "${scheme}" não é permitido em "${prop.name}" ${ALLOWED_SUFFIX}.`
}
