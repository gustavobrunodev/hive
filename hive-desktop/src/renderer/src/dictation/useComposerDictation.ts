import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import {
  useDictation,
  type Dictation,
  type DictationEngine,
  type DictationTarget
} from './useDictation'

/**
 * Dictation wired to a controlled `<textarea>` — the piece every field that
 * gains dictation will need, and the reason Chat's own file barely grows
 * (VP-R5.1, and the design's note about `Chat.tsx`'s complexity budget).
 *
 * It takes the field's state as arguments rather than reaching for it, so it
 * still imports nothing from `chat/`: the chat composer is one caller of this,
 * not its owner.
 */

export interface ComposerDictationOptions {
  /** The field's current value. */
  value: string
  /** The field's setter. */
  setValue: (value: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  engine: DictationEngine
}

export interface ComposerDictation extends Dictation {
  /**
   * `[start, end)` of the run a segment just landed in, for the backdrop mark,
   * cleared automatically (VP-R2.3).
   */
  freshRange: readonly [number, number] | null
  /**
   * Composer-scoped keys: **Esc** discards (VP-R1.5) and the toggle shortcut
   * starts/stops a take (VP-R1.7). Call it from the composer's capture-phase
   * handler, *after* any open menu has had its chance at the event — Esc
   * belongs to the menu first.
   */
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/**
 * The composer-scoped toggle (VP-R1.7).
 *
 * Checked against the app's bindings before choosing it: `Ctrl/Cmd+P`
 * (file search), `+Shift+G` (source control), `+Shift+K` (ask the base),
 * `+Shift+B` (base sidebar), `+S` (save), `+Enter` (commit) are taken;
 * `+Shift+D` is free, and D reads as *ditar*.
 */
export const DICTATION_TOGGLE_KEY = 'd'

/** How long the freshly-landed run stays marked. Matches the CSS fade. */
const FRESH_MARK_MS = 600

export function useComposerDictation({
  value,
  setValue,
  textareaRef,
  engine
}: ComposerDictationOptions): ComposerDictation {
  const [freshRange, setFreshRange] = useState<readonly [number, number] | null>(null)

  /**
   * The value, mirrored for `read()` — which runs inside async transcription
   * callbacks, long after the render that produced the value it needs.
   */
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  /** Where the caret must land once React has committed the new value. */
  const pendingCaretRef = useRef<number | null>(null)

  const target = useMemo<DictationTarget>(
    () => ({
      read: () => {
        const element = textareaRef.current
        const current = valueRef.current
        // A field that is not focused has no meaningful selection; appending at
        // the end is the honest default.
        return {
          value: current,
          selectionStart: element?.selectionStart ?? current.length,
          selectionEnd: element?.selectionEnd ?? current.length
        }
      },
      write: ({ value: next, caret, range }) => {
        setValue(next)
        pendingCaretRef.current = caret
        // An empty range means nothing arrived (a discard's rewind, an empty
        // segment) — marking it would flash a zero-width highlight.
        setFreshRange(range[0] === range[1] ? null : range)
      }
    }),
    [setValue, textareaRef]
  )

  const dictation = useDictation(target, engine)

  // The caret is restored after the commit that carries the new value: setting
  // it before would place it in the old text and the browser would clamp it.
  useEffect(() => {
    const caret = pendingCaretRef.current
    if (caret === null) return
    pendingCaretRef.current = null
    const element = textareaRef.current
    if (element === null) return
    element.focus()
    element.setSelectionRange(caret, caret)
  })

  // The mark is a glance, not a state: it clears itself (VP-R2.3).
  useEffect(() => {
    if (freshRange === null) return
    const timer = setTimeout(() => setFreshRange(null), FRESH_MARK_MS)
    return () => clearTimeout(timer)
  }, [freshRange])

  const { active, start, finish, discard } = dictation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) return
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        if (event.key.toLowerCase() !== DICTATION_TOGGLE_KEY) return
        event.preventDefault()
        // Toggling OFF concludes the take rather than throwing it away —
        // discarding is Esc's job (VP-R1.5), and it is spelled out as such.
        if (active) finish()
        else start()
        return
      }
      // Esc discards the take and rewinds the draft (VP-R1.5). Only while a
      // take is live, so it keeps its usual meaning the rest of the time.
      if (event.key === 'Escape' && active) {
        event.preventDefault()
        discard()
      }
    },
    [active, discard, finish, start]
  )

  return { ...dictation, freshRange, handleKeyDown }
}
