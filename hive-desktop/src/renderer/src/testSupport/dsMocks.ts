import { createElement } from 'react'

/**
 * Props `HighlightedTextarea` owns and that must never reach the DOM. React
 * warns about every unknown attribute on a `<textarea>`, and a test whose
 * output is buried in warnings is a test nobody reads.
 */
const OWN_PROPS = new Set(['highlight', 'active', 'minRows', 'maxRows', 'submitOnEnter'])

/**
 * A stand-in for the DS `HighlightedTextarea` in jsdom.
 *
 * The backdrop mirror is the component's own concern and has its own tests;
 * everything a *consumer* test cares about — the value, the change handler, the
 * accessible name — belongs to the real `<textarea>` underneath, so that is all
 * this renders. Shared rather than copied into each `vi.mock` factory: the
 * hand-rolled Whisper stub that drifted from its bridge is the precedent.
 */
export function HighlightedTextareaMock(props: Record<string, unknown>): React.JSX.Element {
  const rest = Object.fromEntries(Object.entries(props).filter(([key]) => !OWN_PROPS.has(key)))
  return createElement('textarea', rest)
}
