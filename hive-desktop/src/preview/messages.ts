/**
 * Design Studio (M18) — the wire between the Studio tab and the in-frame
 * receiver. One file, imported by both sides, so the contract cannot drift.
 *
 * The frame is `sandbox="allow-scripts"` **without** `allow-same-origin`, so
 * its origin is opaque and `event.origin` arrives as the string `"null"`
 * (design §1.1, D-DS-4). Matching that string would be a control that controls
 * nothing, so every message carries a `nonce` instead: the same unguessable
 * per-session token that is already in the frame's URL. The parent additionally
 * checks `event.source === frame.contentWindow`; the frame checks the nonce,
 * which only its parent can know.
 */

/**
 * The Screen as the frame sees it. Structurally the main process's
 * `ScreenNode`, restated here because the preview bundle is its own process
 * zone and must not import main.
 */
export interface PreviewNode {
  id: string
  tag: string
  props: Record<string, string | number | boolean>
  /** Slot of the parent; absent = default slot. */
  slot?: string
  children: PreviewNode[]
}

export interface PreviewDocument {
  screenId: string
  /** `null` = the Screen has no Components yet. */
  root: PreviewNode | null
}

/** Parent → frame. */
export type PreviewInbound =
  | { type: 'render'; nonce: string; document: PreviewDocument }
  | { type: 'select'; nonce: string; componentId: string | null }
  /**
   * T6.6 / §3.9: outline the nodes a chat turn just changed, for one beat.
   * It answers the question the user asks every single time a turn lands —
   * *what changed?* — which is why it is the one piece of motion in the Studio
   * that is not a state transition.
   */
  | { type: 'pulse'; nonce: string; componentIds: string[] }

/** Frame → parent. */
export type PreviewOutbound =
  { type: 'ready'; nonce: string } | { type: 'selected'; nonce: string; componentId: string | null }

/**
 * Narrows an untrusted `event.data` to a message for `nonce`.
 *
 * Shared by both sides on purpose: the nonce check is the security control
 * (D-DS-4), and a control implemented twice is a control that will one day be
 * implemented differently.
 */
export function messageFor<T extends { type: string; nonce: string }>(
  data: unknown,
  nonce: string,
  types: readonly T['type'][]
): T | null {
  if (!data || typeof data !== 'object') return null
  const message = data as { type?: unknown; nonce?: unknown }
  if (typeof message.type !== 'string' || !types.includes(message.type)) return null
  // Compared as a plain string: both sides hold the same 64-hex token, and a
  // mismatch is a message from something that never saw the frame's URL.
  if (typeof message.nonce !== 'string' || message.nonce !== nonce) return null
  return data as T
}
